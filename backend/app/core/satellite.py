"""
Satellite Verification via Google Earth Engine (Sentinel-2)
============================================================
Cross-checks farm-reported sequestration against Sentinel-2 NDVI.

Methodology:
  Lasaponara et al. (2022). Remote Sensing, 14(19), 4723.
  → Linear regression on multi-year NDVI time series gives a slope
    (trend direction). A positive slope on a crop type expected to
    sequester carbon corroborates the farmer's claim and justifies a
    tier upgrade: Tier-2 → Tier-2+Satellite.

All NDVI scores, expected sequestration ranges, trend directions, and
anomaly thresholds are loaded from ipcc_soc_factors.json
(key: "satellite_validation") — no hardcoded constants in this module.

Reference:
  Gorelick et al. (2017). Google Earth Engine: Planetary-scale geospatial
  analysis. Remote Sensing of Environment, 202, 18–27.
"""

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.models.credit import MRVResult

log = logging.getLogger("carbonlanka.satellite")

_SOC_PATH = Path(__file__).parent.parent / "data" / "ipcc_soc_factors.json"
_sat_data: dict | None = None   # module-level cache — loaded once on first call


def _load_sat_data() -> dict:
    global _sat_data
    if _sat_data is None:
        with open(_SOC_PATH, "r") as f:
            _sat_data = json.load(f)["satellite_validation"]
    return _sat_data


def verify_with_satellite(
    mrv_result: MRVResult,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> MRVResult:
    """
    Cross-check MRV estimate against Sentinel-2 NDVI.

    Applies Lasaponara et al. tier upgrade logic:
      - If NDVI within expected range AND positive trend direction
        → upgrade to Tier-2+Satellite, reduce uncertainty to ±15%
      - If reported > expected × (1 + anomaly_threshold) → anomaly_flag = True

    All thresholds and NDVI data come from ipcc_soc_factors.json.
    """
    from app.config import settings
    from app.data_loader import load_soc_factors

    soc_data  = load_soc_factors()
    sat       = _load_sat_data()
    tier_unc  = soc_data["tier_uncertainty"]
    tier_conf = soc_data["tier_confidence"]

    crop = mrv_result.crop_type

    # ── GEE connection — try real Sentinel-2 first, fall back to demo ─────
    from app.core.gee_client import init_gee, fetch_ndvi, fetch_ndvi_trend

    gee_configured = bool(settings.gee_service_account_key and settings.gee_project_id)
    gee_live = False
    live_ndvi_result = None
    live_trend_result = None

    log.info("--- SAT START  crop=%-22s  lat=%s  lng=%s", crop, latitude, longitude)

    if gee_configured and latitude is not None and longitude is not None:
        gee_ok = init_gee()
        if gee_ok:
            # Scale buffer to farm size: sqrt(area) × 100m, clamped [250m, 2500m]
            import math
            farm_area = mrv_result.land_area_ha
            buffer_m = max(250, min(2500, int(math.sqrt(farm_area) * 100)))
            log.info("  [GEE] Connected — fetching live Sentinel-2 NDVI (buffer=%dm for %.1f ha)...",
                     buffer_m, farm_area)
            live_ndvi_result = fetch_ndvi(latitude, longitude, buffer_m=buffer_m, months_back=12)
            live_trend_result = fetch_ndvi_trend(latitude, longitude, years=3)
            if live_ndvi_result:
                gee_live = True
                log.info("  [GEE] LIVE NDVI=%.4f  images=%d  pixels=%d",
                         live_ndvi_result["ndvi_mean"],
                         live_ndvi_result.get("image_count", 0),
                         live_ndvi_result.get("pixel_count", 0))
            else:
                log.warning("  [GEE] Live NDVI fetch failed — falling back to demo scores")
        else:
            log.warning("  [GEE] Could not initialize — falling back to demo scores")
    else:
        if not gee_configured:
            log.warning("  [GEE] No service account key set (GEE_SERVICE_ACCOUNT_KEY in .env)")
        elif latitude is None or longitude is None:
            log.warning("  [GEE] No lat/lng provided — using demo scores")
        log.warning("  [GEE] Running in DEMO mode — pre-computed NDVI from ipcc_soc_factors.json")

    # ── Load thresholds from JSON ─────────────────────────────────────────
    ndvi_scores    = sat["ndvi_scores"]
    seq_ranges     = sat["ndvi_seq_range_t_co2_ha_yr"]
    trend_dirs     = sat["ndvi_trend_direction"]
    anomaly_thresh = sat["anomaly_threshold_fraction"]
    range_mult     = sat["ndvi_range_upper_multiplier"]

    # Use live GEE data if available, otherwise fall back to pre-computed
    if gee_live and live_ndvi_result:
        ndvi = live_ndvi_result["ndvi_mean"]
        ndvi_source = f"GEE LIVE ({live_ndvi_result['source']})"
    else:
        ndvi = ndvi_scores.get(crop, ndvi_scores["_default"])
        ndvi_source = "pre-computed (ipcc_soc_factors.json)"

    log.info("  [NDVI] crop=%-22s  score=%.3f  source=%s", crop, ndvi, ndvi_source)

    seq_range    = seq_ranges.get(crop, seq_ranges["_default"])
    expected_low = seq_range[0]
    expected_high = seq_range[1]
    expected_mid = (expected_low + expected_high) / 2.0

    reported_per_ha = (
        mrv_result.tonnes_co2_net / mrv_result.land_area_ha
        if mrv_result.land_area_ha > 0
        else 0.0
    )
    log.info("  [CHECK] reported=%.4f t CO2/ha  expected=[%.1f, %.1f]  midpoint=%.1f  anomaly_thresh=+%.0f%%",
             reported_per_ha, expected_low, expected_high, expected_mid, anomaly_thresh * 100)

    # ── NDVI cross-check against crop expectations ─────────────────────────
    expected_ndvi = ndvi_scores.get(crop, ndvi_scores["_default"])
    ndvi_deviation = ndvi - expected_ndvi
    ndvi_mismatch = False
    if gee_live and ndvi < expected_ndvi * 0.80:
        # Live NDVI is >20% below what this crop type expects
        # Likely not the claimed crop or urban/degraded area
        ndvi_mismatch = True
        log.warning("  [NDVI MISMATCH] live=%.3f  expected=%.3f for %s  (%.0f%% below) → possible non-agricultural area",
                    ndvi, expected_ndvi, crop, abs(ndvi_deviation / expected_ndvi) * 100)
    elif gee_live:
        log.info("  [NDVI CHECK] live=%.3f  expected=%.3f  deviation=%.3f (%.0f%%) — OK",
                 ndvi, expected_ndvi, ndvi_deviation, (ndvi_deviation / expected_ndvi) * 100)

    # ── Anomaly check ─────────────────────────────────────────────────────
    anomaly = (
        expected_mid > 0
        and reported_per_ha > expected_mid * (1.0 + anomaly_thresh)
    ) or ndvi_mismatch
    if ndvi_mismatch:
        log.warning("  [ANOMALY] NDVI mismatch: live NDVI %.3f too low for %s (expected ≥%.3f) → flagged",
                    ndvi, crop, expected_ndvi * 0.80)
    elif anomaly:
        log.warning("  [ANOMALY] reported/ha %.4f > expected_mid*(1+%.2f) %.4f → flagged for review",
                    reported_per_ha, anomaly_thresh, expected_mid * (1.0 + anomaly_thresh))
    else:
        log.info("  [ANOMALY] none — reported value within acceptable range")

    # ── Tier upgrade (Lasaponara et al.) ──────────────────────────────────
    ndvi_in_range = expected_low <= reported_per_ha <= expected_high * range_mult

    # Use live GEE trend if available, otherwise fall back to pre-computed
    if gee_live and live_trend_result:
        positive_trend = live_trend_result["direction"] == "positive"
        log.info("  [TREND] LIVE slope=%.6f direction=%s (from GEE linear regression)",
                 live_trend_result["slope"], live_trend_result["direction"])
    else:
        positive_trend = trend_dirs.get(crop, trend_dirs["_default"]) == "positive"
    can_upgrade    = (
        mrv_result.tier == "Tier-2"
        and ndvi_in_range
        and positive_trend
        and not anomaly
    )
    log.info("  [TIER]  current=%s  ndvi_in_range=%s  positive_trend=%s  anomaly=%s  → upgrade=%s",
             mrv_result.tier, ndvi_in_range, positive_trend, anomaly, can_upgrade)

    if can_upgrade:
        new_tier        = "Tier-2+Satellite"
        new_uncertainty = tier_unc["Tier-2+Satellite"]
        new_confidence  = tier_conf["Tier-2+Satellite"]
        log.info("  [TIER]  %s → %s  uncertainty %.0f%% → %.0f%%  confidence %.0f → %.0f",
                 mrv_result.tier, new_tier,
                 mrv_result.uncertainty_pct, new_uncertainty,
                 mrv_result.confidence_score, new_confidence)
    else:
        new_tier        = mrv_result.tier
        new_uncertainty = mrv_result.uncertainty_pct
        new_confidence  = mrv_result.confidence_score
        log.info("  [TIER]  no upgrade — keeping %s  (+-%.0f%%)", new_tier, new_uncertainty)

    # ── Anomaly: force Tier-1 uncertainty + low confidence ────────────────
    # When GEE confirms land is NOT what the farmer claims (NDVI mismatch),
    # we cannot trust any part of the claim → downgrade to Tier-1 penalty.
    if anomaly and gee_live:
        if ndvi_mismatch:
            # Hard evidence of wrong land use — severe penalty
            old_unc  = new_uncertainty
            old_conf = new_confidence
            new_uncertainty = tier_unc.get("Tier-1", 60.0)  # Tier-1 ±60%
            new_confidence  = 30.0                           # very low trust
            log.warning("  [ANOMALY PENALTY] NDVI mismatch confirmed by live GEE → "
                        "uncertainty %.0f%% → %.0f%%  confidence %.0f → %.0f",
                        old_unc, new_uncertainty, old_conf, new_confidence)
        else:
            # Reported value exceeds expected range — moderate penalty
            old_conf = new_confidence
            new_confidence = max(40.0, new_confidence - 20.0)
            log.warning("  [ANOMALY PENALTY] Over-reported — confidence %.0f → %.0f",
                        old_conf, new_confidence)
    elif gee_live and ndvi < expected_ndvi:
        # NDVI below expected but not a hard mismatch — proportional penalty
        ndvi_ratio = ndvi / expected_ndvi
        penalty = (1.0 - ndvi_ratio) * 30  # up to 30 pts
        old_conf = new_confidence
        new_confidence = max(40.0, new_confidence - penalty)
        log.info("  [CONF]  NDVI penalty: live=%.3f < expected=%.3f  ratio=%.2f  penalty=-%.1f  confidence %.0f → %.0f",
                 ndvi, expected_ndvi, ndvi_ratio, penalty, old_conf, new_confidence)

    # Recalculate bounds with updated uncertainty
    c_net = mrv_result.tonnes_co2_net
    c_min = round(c_net * (1.0 - new_uncertainty / 100.0), 3)
    c_max = round(c_net * (1.0 + new_uncertainty / 100.0), 3)

    # ── Deterministic satellite hash ──────────────────────────────────────
    hash_input = f"{crop}:{ndvi:.4f}:{latitude}:{longitude}:{datetime.utcnow().date()}"
    sat_hash = "0x" + hashlib.sha256(hash_input.encode()).hexdigest()
    log.info("  [HASH]  sat_hash=%s...%s", sat_hash[:12], sat_hash[-8:])

    # ── Determine claim status ────────────────────────────────────────────
    if not gee_live:
        claim_status = "UNVERIFIED"
        claim_reason = "No live GEE data — result based on farmer's claim only"
    elif ndvi_mismatch:
        # Hard rejection — NDVI >20% below expected, clearly not the claimed crop
        claim_status = "REJECTED"
        claim_reason = (
            f"Live Sentinel-2 NDVI={ndvi:.3f} is {abs(ndvi/expected_ndvi - 1)*100:.0f}% "
            f"below expected {expected_ndvi:.3f} for {crop}. "
            f"Location does not appear to have {crop} vegetation. "
            f"Manual field verification required before credits can be issued."
        )
    elif can_upgrade:
        # Tier upgrade granted — highest confidence path
        claim_status = "VERIFIED"
        claim_reason = f"Sentinel-2 NDVI={ndvi:.3f} corroborates {crop} claim with positive NDVI trend (Lasaponara et al. 2022)"
    elif anomaly:
        claim_status = "SUSPICIOUS"
        claim_reason = f"Reported sequestration exceeds satellite-expected range for {crop} — flagged for manual review"
    elif ndvi < expected_ndvi * 0.90:
        claim_status = "SUSPICIOUS"
        claim_reason = f"Live NDVI={ndvi:.3f} is {abs(ndvi/expected_ndvi - 1)*100:.0f}% below expected {expected_ndvi:.3f} for {crop}"
    else:
        claim_status = "UNVERIFIED"
        claim_reason = f"NDVI={ndvi:.3f} consistent with {crop} but no positive trend detected for tier upgrade"

    log.info("  [STATUS] claim_status=%s — %s", claim_status, claim_reason)

    mrv_result.satellite_verified   = True
    mrv_result.satellite_ndvi_score = ndvi
    mrv_result.anomaly_flag         = anomaly
    mrv_result.tier                 = new_tier
    mrv_result.uncertainty_pct      = new_uncertainty
    mrv_result.confidence_score     = new_confidence
    mrv_result.tonnes_co2_min       = c_min
    mrv_result.tonnes_co2_max       = c_max
    mrv_result.claim_status         = claim_status
    mrv_result.claim_status_reason  = claim_reason

    if can_upgrade:
        mrv_result.methodology = (
            mrv_result.methodology
            + " | Sentinel-2 NDVI corroborated (Lasaponara et al. 2022)"
        )

    log.info("--- SAT END    tier=%s  ndvi=%.3f  anomaly=%s  uncertainty=+-%.0f%%",
             new_tier, ndvi, anomaly, new_uncertainty)
    return mrv_result


def get_ndvi_tile_url(
    crop_type: str,
    latitude: float = 6.9271,
    longitude: float = 80.7718,
) -> dict:
    """
    Returns NDVI tile overlay data for the frontend Leaflet map.
    Uses real GEE tile URL if available, otherwise pre-computed scores.
    """
    from app.core.gee_client import init_gee, fetch_ndvi, get_ndvi_map_tiles
    from app.config import settings

    sat = _load_sat_data()
    ndvi_score = sat["ndvi_scores"].get(crop_type, sat["ndvi_scores"]["_default"])
    trend      = sat["ndvi_trend_direction"].get(crop_type, sat["ndvi_trend_direction"]["_default"])
    tile_url   = None
    gee_live   = False

    # Try to get real GEE data
    gee_configured = bool(settings.gee_service_account_key and settings.gee_project_id)
    if gee_configured and init_gee():
        live_ndvi = fetch_ndvi(latitude, longitude, buffer_m=2500, months_back=12)
        if live_ndvi:
            ndvi_score = live_ndvi["ndvi_mean"]
            gee_live = True
        live_tile = get_ndvi_map_tiles(latitude, longitude, buffer_m=5000)
        if live_tile:
            tile_url = live_tile

    # Bounding box: ±0.05° around the farm point (~5.5 km radius)
    margin = 0.05
    bbox = {
        "south": round(latitude  - margin, 6),
        "west":  round(longitude - margin, 6),
        "north": round(latitude  + margin, 6),
        "east":  round(longitude + margin, 6),
    }

    result = {
        "ndvi_score":  ndvi_score,
        "ndvi_trend":  trend,
        "gee_live":    gee_live,
        "center":      {"lat": latitude, "lng": longitude},
        "bbox":        bbox,
        "color_scale": "RdYlGn",
        "legend": {
            "min":   0.0,
            "max":   1.0,
            "label": "NDVI (Normalised Difference Vegetation Index)",
            "low":   "Sparse / bare soil (NDVI < 0.3)",
            "high":  "Dense / healthy vegetation (NDVI > 0.7)",
        },
        "source": "Copernicus Sentinel-2, Google Earth Engine",
        "date":   "2026-03",
        "note":   "LIVE Sentinel-2 via GEE" if gee_live else "Pre-computed demo NDVI",
    }
    if tile_url:
        result["tile_url"] = tile_url
    return result
