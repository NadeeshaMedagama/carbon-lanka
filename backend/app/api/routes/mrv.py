import logging
import time
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.farm import FarmInput
from app.models.credit import MRVResult
from app.core.mrv_engine import calculate_carbon
from app.core.satellite import verify_with_satellite, get_ndvi_tile_url

router = APIRouter(prefix="/mrv", tags=["MRV"])
log = logging.getLogger("carbonlanka.routes.mrv")


@router.post("/calculate", response_model=MRVResult)
async def calculate_mrv(farm: FarmInput) -> MRVResult:
    """
    Run IPCC Tier-2 carbon estimation for a farm.

    Returns net CO2 tonnes, value range (USD + LKR), uncertainty bounds,
    confidence score, and methodology reference.
    """
    t0 = time.perf_counter()
    log.info(">>> POST /mrv/calculate  crop=%s  area=%.2f ha  district=%s",
             farm.crop_type, farm.land_area_ha, farm.district or "(none)")
    try:
        result = calculate_carbon(farm)
        ms = (time.perf_counter() - t0) * 1000
        log.info("<<< /mrv/calculate  co2=%.3f t  tier=%s  confidence=%.0f%%  (%.0f ms)",
                 result.tonnes_co2_net, result.tier, result.confidence_score, ms)
        return result
    except ValueError as exc:
        log.error("<<< /mrv/calculate FAILED: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/verify-satellite", response_model=MRVResult)
async def verify_satellite(
    farm: FarmInput,
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
) -> MRVResult:
    """
    Run MRV calculation then cross-check against Sentinel-2 NDVI via GEE.

    Large discrepancies (>10%) set anomaly_flag=true for manual review.
    """
    t0 = time.perf_counter()
    lat = latitude or farm.latitude
    lng = longitude or farm.longitude
    log.info(">>> POST /mrv/verify-satellite  crop=%s  area=%.2f ha  lat=%s  lng=%s",
             farm.crop_type, farm.land_area_ha, lat, lng)
    try:
        mrv_result = calculate_carbon(farm)
        log.info("    [IPCC done] co2=%.3f t  tier=%s — starting satellite verification...",
                 mrv_result.tonnes_co2_net, mrv_result.tier)
        verified = verify_with_satellite(mrv_result, lat, lng)
        ms = (time.perf_counter() - t0) * 1000
        log.info("<<< /mrv/verify-satellite  co2=%.3f t  tier=%s  ndvi=%.3f  anomaly=%s  (%.0f ms)",
                 verified.tonnes_co2_net, verified.tier,
                 verified.satellite_ndvi_score or 0.0, verified.anomaly_flag, ms)
        return verified
    except ValueError as exc:
        log.error("<<< /mrv/verify-satellite FAILED: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/ndvi-tile")
async def get_ndvi_tile(
    crop_type: str = Query(...),
    latitude: float = Query(default=6.9271),
    longitude: float = Query(default=80.7718),
) -> dict:
    """
    Return NDVI tile overlay data for the Leaflet map.
    Includes NDVI score, bounding box, and color scale metadata.
    """
    t0 = time.perf_counter()
    log.info(">>> GET /mrv/ndvi-tile  crop=%s  lat=%.4f  lng=%.4f", crop_type, latitude, longitude)
    result = get_ndvi_tile_url(crop_type, latitude, longitude)
    ms = (time.perf_counter() - t0) * 1000
    log.info("<<< /mrv/ndvi-tile  ndvi=%.3f  gee_live=%s  (%.0f ms)",
             result.get("ndvi_score", 0.0), result.get("gee_live", False), ms)
    return result


@router.post("/calculate-kgml", response_model=MRVResult)
async def calculate_kgml(
    farm: FarmInput,
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
) -> MRVResult:
    """
    Run IPCC + KGML ensemble carbon estimation.

    1. Runs IPCC Eq. 2.25 (deterministic baseline)
    2. Optionally fetches live GEE data (ERA5 weather, SoilGrids, Sentinel-2 NDVI)
    3. Runs KGML-ag-Carbon GRU model (Liu et al. 2024)
    4. Returns weighted ensemble: (1-w)*IPCC + w*KGML
    """
    from app.core.kgml_model import predict_kgml, ensemble_estimate, is_model_loaded
    from app.core.gee_client import init_gee, fetch_ndvi, fetch_era5_daily, fetch_soilgrids
    from app.data_loader import load_soc_factors

    t0 = time.perf_counter()
    lat = latitude or farm.latitude
    lng = longitude or farm.longitude
    log.info(">>> POST /mrv/calculate-kgml  crop=%s  area=%.2f ha  lat=%s  lng=%s",
             farm.crop_type, farm.land_area_ha, lat, lng)
    try:
        # Step 1: IPCC baseline
        log.info("    [Step 1/5] Running IPCC Eq.2.25 baseline...")
        ipcc_result = calculate_carbon(farm)
        log.info("    [Step 1/5] IPCC done: co2=%.3f t  tier=%s",
                 ipcc_result.tonnes_co2_net, ipcc_result.tier)

        if not is_model_loaded():
            from app.core.kgml_model import _load_model
            log.info("    [Step 1/5] KGML model not loaded — attempting load...")
            _load_model()

        if not is_model_loaded():
            log.warning("    [Step 1/5] KGML model unavailable — returning pure IPCC result")
            return ipcc_result

        # Step 2: Fetch GEE data if available
        log.info("    [Step 2/5] Fetching GEE data (ERA5 weather + SoilGrids + NDVI)...")
        weather_data = None
        soil_data = None
        ndvi_score = None

        if init_gee() and lat and lng:
            weather_data = fetch_era5_daily(lat, lng, days=365)
            log.info("    [Step 2/5] ERA5: %s days fetched",
                     len(weather_data) if weather_data else "0 (using synthetic)")
            soil_data = fetch_soilgrids(lat, lng)
            log.info("    [Step 2/5] SoilGrids: %s",
                     f"soc={soil_data['soc_g_kg']:.1f} g/kg" if soil_data else "unavailable (using zone defaults)")
            ndvi_result = fetch_ndvi(lat, lng)
            if ndvi_result:
                ndvi_score = ndvi_result["ndvi_mean"]
                log.info("    [Step 2/5] NDVI: %.4f (live Sentinel-2)", ndvi_score)
            else:
                log.info("    [Step 2/5] NDVI: unavailable (using synthetic pattern)")
        else:
            log.warning("    [Step 2/5] GEE not connected or lat/lng missing — all inputs synthetic")

        # Resolve climate zone
        soc_data = load_soc_factors()
        climate_zone = soc_data["district_climate_zone"].get(
            farm.district or "", "tropical_moist"
        )
        log.info("    [Step 2/5] Climate zone: %s", climate_zone)

        # Step 3: KGML prediction
        log.info("    [Step 3/5] Running KGML GRU model inference...")
        kgml_result = predict_kgml(
            farm,
            climate_zone=climate_zone,
            weather_data=weather_data,
            soil_data=soil_data,
            ndvi_score=ndvi_score,
        )

        if kgml_result is None:
            log.warning("    [Step 3/5] KGML returned None — returning pure IPCC result")
            return ipcc_result

        log.info("    [Step 3/5] KGML done: delta_SOC=%.4f t C/ha  co2=%.3f t  confidence=%.0f%%",
                 kgml_result["kgml_delta_soc"], kgml_result["kgml_co2_net"], kgml_result["kgml_confidence"])

        # Step 4: Satellite verification (for ensemble weight)
        if lat and lng:
            log.info("    [Step 4/5] Running satellite verification for ensemble weight...")
            ipcc_result = verify_with_satellite(ipcc_result, lat, lng)
            log.info("    [Step 4/5] Satellite done: tier=%s  satellite_verified=%s",
                     ipcc_result.tier, ipcc_result.satellite_verified)
        else:
            log.info("    [Step 4/5] Skipping satellite verification (no lat/lng)")

        # Step 5: Ensemble
        log.info("    [Step 5/5] Computing ensemble (IPCC + KGML)...")
        result = ensemble_estimate(ipcc_result, kgml_result)
        ms = (time.perf_counter() - t0) * 1000
        log.info("<<< /mrv/calculate-kgml  ensemble_co2=%.3f t  ipcc=%.3f  kgml=%.3f  w_kgml=%.0f%%  (%.0f ms)",
                 result.tonnes_co2_net,
                 ipcc_result.tonnes_co2_net,
                 kgml_result["kgml_co2_net"],
                 (result.ensemble_weight_kgml or 0) * 100, ms)
        return result

    except ValueError as exc:
        log.error("<<< /mrv/calculate-kgml FAILED: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/kgml-status")
async def kgml_status() -> dict:
    """Check KGML model and GEE connection status."""
    from app.core.kgml_model import is_model_loaded, get_model_info, _load_model
    from app.core.gee_client import init_gee

    # Try loading if not already loaded
    if not is_model_loaded():
        _load_model()

    return {
        "kgml_model_loaded": is_model_loaded(),
        "gee_connected": init_gee(),
        "model_info": get_model_info(),
    }


@router.get("/crop-types")
async def list_crop_types() -> list[dict]:
    """List all supported crop types with labels."""
    import json
    from pathlib import Path
    ef_path = Path(__file__).parent.parent.parent / "data" / "ipcc_emission_factors.json"
    with open(ef_path) as f:
        efs = json.load(f)
    return [
        {"key": k, "label": v["label"], "description": v["description"]}
        for k, v in efs.items()
        if not k.startswith("_")
    ]
