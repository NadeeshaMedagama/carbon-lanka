"""
KGML-ag-Carbon Model — Knowledge-Guided Machine Learning for SOC Estimation
=============================================================================
Adapted from Liu et al. (2024). Nature Communications 15:357.

Architecture: 2-layer GRU with 3 output heads (NEE, Rh, Yield) and
knowledge-guided mass balance constraint: ΔSOC = −NEE − Yield.

This module:
  1. Loads the trained PyTorch model from app/models/kgml_soc_model.pt
  2. Provides predict_kgml(farm, weather_data, soil_data) → dict
  3. Provides ensemble_estimate(ipcc_result, kgml_result) → MRVResult
  4. Falls back gracefully when model/data is unavailable
"""

import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np

log = logging.getLogger("carbonlanka.kgml")

_MODEL_DIR = Path(__file__).parent.parent / "models"
_model = None
_config = None


# ── Crop Type Mapping ────────────────────────────────────────────────────
# Must match notebook 02 training data generation
CROP_TO_ID = {
    "tea_organic": 0,
    "tea_conventional": 1,
    "rubber_agroforestry": 2,
    "paddy_rice": 3,
    "spice_cinnamon": 4,
    "coconut_organic": 5,
    "forest_regen": 6,
}

# Climate zone weather defaults (same as notebook 02)
_ZONE_WEATHER = {
    "tropical_montane": {"t_mean": 18.0, "t_amp": 3.0, "precip_annual_mm": 2500, "rad_base": 220},
    "tropical_wet":     {"t_mean": 27.0, "t_amp": 2.0, "precip_annual_mm": 3500, "rad_base": 250},
    "tropical_moist":   {"t_mean": 28.0, "t_amp": 3.0, "precip_annual_mm": 2000, "rad_base": 280},
    "tropical_dry":     {"t_mean": 30.0, "t_amp": 4.0, "precip_annual_mm": 1200, "rad_base": 310},
}

_ZONE_SOIL = {
    "tropical_montane": {"soc_g_kg": 25.0, "bd": 1.1, "ph": 5.2, "clay": 35.0},
    "tropical_wet":     {"soc_g_kg": 18.0, "bd": 1.2, "ph": 5.5, "clay": 40.0},
    "tropical_moist":   {"soc_g_kg": 12.0, "bd": 1.3, "ph": 6.0, "clay": 30.0},
    "tropical_dry":     {"soc_g_kg": 6.0,  "bd": 1.4, "ph": 6.8, "clay": 20.0},
}

_NDVI_PATTERNS = {
    "tea_organic":         {"base": 0.72, "amp": 0.05, "phase": 0},
    "tea_conventional":    {"base": 0.60, "amp": 0.06, "phase": 0},
    "rubber_agroforestry": {"base": 0.80, "amp": 0.04, "phase": 30},
    "paddy_rice":          {"base": 0.45, "amp": 0.25, "phase": 60},
    "spice_cinnamon":      {"base": 0.68, "amp": 0.05, "phase": 0},
    "coconut_organic":     {"base": 0.70, "amp": 0.04, "phase": 15},
    "forest_regen":        {"base": 0.85, "amp": 0.03, "phase": 0},
}


def _load_model():
    """Load the trained KGML model and config. Returns True on success."""
    global _model, _config

    if _model is not None:
        return True

    config_path = _MODEL_DIR / "kgml_config.json"
    model_path = _MODEL_DIR / "kgml_soc_model.pt"

    if not config_path.exists() or not model_path.exists():
        log.warning("[KGML] Model files not found at %s — KGML disabled", _MODEL_DIR)
        log.warning("[KGML] Run notebooks/03_kgml_model_training.ipynb to train the model")
        return False

    try:
        import torch
        import torch.nn as nn

        with open(config_path) as f:
            _config = json.load(f)

        # Define model class inline to avoid circular import
        class KGMLSocModel(nn.Module):
            def __init__(self, input_dim=8, crop_vocab=7, crop_embed_dim=4,
                         hidden_dim=64, num_layers=2, dropout=0.1):
                super().__init__()
                self.crop_embed = nn.Embedding(crop_vocab, crop_embed_dim)
                self.input_proj = nn.Linear(input_dim + crop_embed_dim, hidden_dim // 2)
                self.gru = nn.GRU(
                    input_size=hidden_dim // 2, hidden_size=hidden_dim,
                    num_layers=num_layers, batch_first=True,
                    dropout=dropout if num_layers > 1 else 0.0,
                )
                self.nee_head = nn.Linear(hidden_dim, 1)
                self.rh_head = nn.Linear(hidden_dim, 1)
                self.yield_head = nn.Linear(hidden_dim, 1)
                self.dropout = nn.Dropout(dropout)

            def forward(self, features, crop_ids):
                B, T, _ = features.shape
                crop_emb = self.crop_embed(crop_ids).unsqueeze(1).expand(-1, T, -1)
                x = torch.cat([features, crop_emb], dim=-1)
                x = torch.relu(self.input_proj(x))
                h, _ = self.gru(x)
                h = self.dropout(h)
                nee = self.nee_head(h).squeeze(-1)
                rh = self.rh_head(h).squeeze(-1)
                yield_proxy = self.yield_head(h).squeeze(-1)
                annual_nee = nee.sum(dim=1)
                annual_yield = yield_proxy.sum(dim=1)
                delta_soc = -annual_nee - annual_yield
                return {
                    "nee": nee, "rh": rh, "yield_proxy": yield_proxy,
                    "delta_soc": delta_soc,
                    "annual_nee": annual_nee, "annual_yield": annual_yield,
                }

        _model = KGMLSocModel(
            input_dim=_config["input_dim"],
            crop_vocab=_config["crop_vocab"],
            crop_embed_dim=_config["crop_embed_dim"],
            hidden_dim=_config["hidden_dim"],
            num_layers=_config["num_layers"],
            dropout=_config["dropout"],
        )
        _model.load_state_dict(torch.load(model_path, weights_only=True, map_location="cpu"))
        _model.eval()

        n_params = sum(p.numel() for p in _model.parameters())
        log.info("[KGML] Model loaded: v%s  |  %d params  |  val_loss=%.6f",
                 _config["version"], n_params, _config.get("best_val_loss", 0))
        return True

    except Exception as exc:
        log.error("[KGML] Failed to load model: %s", exc)
        _model = None
        _config = None
        return False


def is_model_loaded() -> bool:
    """Check if KGML model is available."""
    return _model is not None


def get_model_info() -> dict:
    """Return model metadata for /mrv/kgml-status endpoint."""
    if _config:
        return {
            "version": _config.get("version", "unknown"),
            "parameters": sum(p.numel() for p in _model.parameters()) if _model else 0,
            "crop_types": list(CROP_TO_ID.keys()),
        }
    return {"version": "not loaded", "parameters": 0, "crop_types": []}


def _generate_synthetic_weather(climate_zone: str) -> np.ndarray:
    """Generate 365 days of synthetic weather when GEE ERA5 is unavailable."""
    zw = _ZONE_WEATHER.get(climate_zone, _ZONE_WEATHER["tropical_moist"])
    days = np.arange(365)

    temp = zw["t_mean"] + zw["t_amp"] * np.sin(2 * np.pi * days / 365) + np.random.normal(0, 1.5, 365)
    seasonal = 1.0 + 0.5 * np.sin(2 * np.pi * (days - 120) / 365)
    daily_mean = zw["precip_annual_mm"] / 365
    precip = np.random.gamma(0.3, daily_mean / 0.3 * seasonal)
    precip = np.clip(precip, 0, 100)
    rad = zw["rad_base"] - 0.3 * precip + np.random.normal(0, 20, 365)
    rad = np.clip(rad, 50, 400)

    return np.column_stack([temp, precip, rad]).astype(np.float32)


def _generate_ndvi(crop_type: str) -> np.ndarray:
    """Generate 365 days of synthetic NDVI for a crop type."""
    p = _NDVI_PATTERNS.get(crop_type, {"base": 0.6, "amp": 0.05, "phase": 0})
    days = np.arange(365)
    ndvi = p["base"] + p["amp"] * np.sin(2 * np.pi * (days - p["phase"]) / 365)
    ndvi += np.random.normal(0, 0.02, 365)
    return np.clip(ndvi, 0.05, 0.95).astype(np.float32)


def _get_soil_properties(climate_zone: str, soil_data: Optional[dict] = None) -> tuple:
    """Get soil properties from GEE data or zone defaults."""
    if soil_data:
        return (
            soil_data.get("soc_g_kg", 12.0),
            soil_data.get("bulk_density_kg_dm3", 1.2),
            soil_data.get("ph", 6.0),
            soil_data.get("clay_pct", 30.0),
        )
    zs = _ZONE_SOIL.get(climate_zone, _ZONE_SOIL["tropical_moist"])
    return zs["soc_g_kg"], zs["bd"], zs["ph"], zs["clay"]


def predict_kgml(
    farm,
    climate_zone: str = "tropical_moist",
    weather_data: Optional[list] = None,
    soil_data: Optional[dict] = None,
    ndvi_score: Optional[float] = None,
) -> Optional[dict]:
    """
    Run KGML model prediction for a single farm.

    Args:
        farm: FarmInput instance
        climate_zone: auto-derived from district
        weather_data: ERA5 daily data from GEE (or None for synthetic)
        soil_data: SoilGrids data from GEE (or None for defaults)
        ndvi_score: Live NDVI from GEE (or None for synthetic)

    Returns:
        dict with kgml_delta_soc, kgml_co2_net, kgml_confidence, etc.
        None if model not loaded or crop not supported.
    """
    if not _load_model():
        return None

    import torch

    crop_type = farm.crop_type
    if crop_type not in CROP_TO_ID:
        log.warning("[KGML] Crop type '%s' not in KGML training data — skipping", crop_type)
        return None

    log.info("--- KGML START  crop=%-22s  zone=%s", crop_type, climate_zone)

    # ── Build daily features (365, 8) ─────────────────────────────────────
    # Weather (365, 3): temp, precip, radiation
    if weather_data and len(weather_data) >= 30:
        # Pad or trim to 365 days
        n = len(weather_data)
        temp = np.array([d["temperature_c"] for d in weather_data], dtype=np.float32)
        precip = np.array([d["precipitation_mm"] for d in weather_data], dtype=np.float32)
        rad = np.array([d["radiation_wm2"] for d in weather_data], dtype=np.float32)
        if n < 365:
            # Repeat to fill 365 days
            reps = (365 // n) + 1
            temp = np.tile(temp, reps)[:365]
            precip = np.tile(precip, reps)[:365]
            rad = np.tile(rad, reps)[:365]
        else:
            temp, precip, rad = temp[:365], precip[:365], rad[:365]
        weather = np.column_stack([temp, precip, rad])
        log.info("  [KGML] Using GEE ERA5 weather (%d days)", min(n, 365))
    else:
        weather = _generate_synthetic_weather(climate_zone)
        log.info("  [KGML] Using synthetic weather (zone=%s)", climate_zone)

    # NDVI (365,)
    if ndvi_score is not None:
        # Use live NDVI as base, add seasonal variation
        p = _NDVI_PATTERNS.get(crop_type, {"amp": 0.05, "phase": 0})
        days = np.arange(365)
        ndvi = ndvi_score + p["amp"] * np.sin(2 * np.pi * (days - p["phase"]) / 365)
        ndvi = np.clip(ndvi, 0.05, 0.95).astype(np.float32)
        log.info("  [KGML] Using GEE NDVI base=%.3f", ndvi_score)
    else:
        ndvi = _generate_ndvi(crop_type)
        log.info("  [KGML] Using synthetic NDVI (crop=%s)", crop_type)

    # Soil (4 values, broadcast to 365 days)
    soc, bd, ph, clay = _get_soil_properties(climate_zone, soil_data)
    log.info("  [KGML] Soil: SOC=%.1f g/kg  BD=%.2f  pH=%.1f  clay=%.0f%%", soc, bd, ph, clay)

    # Stack: (365, 8)
    features = np.column_stack([
        weather,                      # 0-2: temp, precip, rad
        ndvi,                         # 3: NDVI (GPP proxy)
        np.full(365, soc),            # 4: SOC
        np.full(365, bd),             # 5: bulk density
        np.full(365, ph),             # 6: pH
        np.full(365, clay),           # 7: clay%
    ]).astype(np.float32)

    # ── Normalize with training stats ──────────────────────────────────────
    feat_mean = np.array(_config["feat_mean"], dtype=np.float32)
    feat_std = np.array(_config["feat_std"], dtype=np.float32)
    feat_std[feat_std < 1e-6] = 1.0
    features_norm = (features - feat_mean) / feat_std

    feat_names = ["temp", "precip", "rad", "ndvi", "soc", "bd", "ph", "clay"]
    for i, name in enumerate(feat_names):
        log.info("  [KGML] Feature[%d] %-8s  mean=%.3f  min=%.3f  max=%.3f",
                 i, name, features[:, i].mean(), features[:, i].min(), features[:, i].max())

    # ── Forward pass ──────────────────────────────────────────────────────
    x = torch.tensor(features_norm).unsqueeze(0)  # (1, 365, 8)
    c = torch.tensor([CROP_TO_ID[crop_type]])       # (1,)

    log.info("  [KGML] Input tensor: %s  crop_id=%d (%s)", list(x.shape), CROP_TO_ID[crop_type], crop_type)

    with torch.no_grad():
        _model.eval()
        outputs = _model(x, c)
        delta_soc_pred = outputs["delta_soc"].item()

    log.info("  [KGML] Forward pass: delta_SOC=%.4f  annual_NEE=%.4f  annual_yield=%.4f",
             delta_soc_pred, outputs["annual_nee"].item(), outputs["annual_yield"].item())

    # ── MC Dropout confidence ─────────────────────────────────────────────
    N_MC = 10
    mc_preds = []
    log.info("  [KGML] MC Dropout: running %d stochastic forward passes...", N_MC)
    _model.train()  # enable dropout
    with torch.no_grad():
        for i in range(N_MC):
            out = _model(x, c)
            mc_preds.append(out["delta_soc"].item())
            log.debug("  [KGML]   MC pass %2d/%d: delta_SOC=%.4f", i + 1, N_MC, mc_preds[-1])
    _model.eval()

    mc_std = np.std(mc_preds)
    confidence = max(0.0, min(100.0, 100.0 - mc_std * 500.0))
    log.info("  [KGML] MC Dropout: mean=%.4f  std=%.6f  min=%.4f  max=%.4f  → confidence=%.1f%%",
             float(np.mean(mc_preds)), mc_std, min(mc_preds), max(mc_preds), confidence)

    # ── Convert to CO2 ───────────────────────────────────────────────────
    from app.data_loader import load_soc_factors
    soc_data = load_soc_factors()
    c_to_co2 = soc_data["soc_calculation"]["c_to_co2_ratio"]
    kgml_co2_net = max(0.0, delta_soc_pred * c_to_co2 * farm.land_area_ha)

    mass_residual = abs(
        delta_soc_pred - (
            -outputs["annual_nee"].item() - outputs["annual_yield"].item()
        )
    )

    log.info("  [KGML] delta_SOC=%.4f t C/ha/yr  →  CO2_net=%.3f t CO2/yr",
             delta_soc_pred, kgml_co2_net)
    log.info("  [KGML] MC confidence=%.1f%%  mass_balance_residual=%.6f",
             confidence, mass_residual)
    log.info("--- KGML END")

    return {
        "kgml_delta_soc": round(delta_soc_pred, 4),
        "kgml_co2_net": round(kgml_co2_net, 3),
        "kgml_confidence": round(confidence, 1),
        "mass_balance_residual": round(mass_residual, 6),
        "daily_nee_sum": round(outputs["annual_nee"].item(), 4),
        "daily_yield_sum": round(outputs["annual_yield"].item(), 4),
        "mc_std": round(mc_std, 6),
        "data_sources": {
            "weather": "GEE ERA5" if (weather_data and len(weather_data) >= 30) else "synthetic",
            "soil": "GEE SoilGrids" if soil_data else "zone defaults",
            "ndvi": "GEE Sentinel-2" if ndvi_score else "synthetic",
        },
    }


def ensemble_estimate(ipcc_result, kgml_result: dict):
    """
    Merge IPCC and KGML predictions into an ensemble estimate.
    KGML weight: 0.4 default, 0.6 when satellite-verified.

    Modifies and returns the MRVResult in place.
    """
    from app.config import settings

    w_kgml_base = 0.6 if ipcc_result.satellite_verified else 0.4

    # Scale KGML weight by model confidence — zero confidence → zero weight
    kgml_conf = kgml_result.get("kgml_confidence", 0.0)
    confidence_scale = max(0.0, min(1.0, kgml_conf / 100.0))
    w_kgml = w_kgml_base * confidence_scale

    log.info("[ENSEMBLE] w_kgml: base=%.2f × confidence_scale=%.2f (%.0f%%) → effective=%.2f",
             w_kgml_base, confidence_scale, kgml_conf, w_kgml)

    ipcc_co2 = ipcc_result.tonnes_co2_net
    kgml_co2 = kgml_result["kgml_co2_net"]

    ensemble_co2 = (1.0 - w_kgml) * ipcc_co2 + w_kgml * kgml_co2
    ensemble_co2 = max(0.0, ensemble_co2)

    # Tighten uncertainty when both methods agree — but NEVER reduce anomaly penalty
    ipcc_unc = ipcc_result.uncertainty_pct / 100.0
    claim_rejected = getattr(ipcc_result, "claim_status", "") == "REJECTED"
    if claim_rejected or ipcc_result.anomaly_flag:
        # Anomaly-penalised uncertainty is a hard floor — ensemble cannot reduce it
        ensemble_unc = ipcc_unc
        agreement_ratio = 0.0
        log.warning("[ENSEMBLE] Anomaly/rejected claim — keeping uncertainty at %.0f%% (no tightening)",
                    ipcc_unc * 100)
    else:
        agreement_ratio = 1.0 - abs(ipcc_co2 - kgml_co2) / max(ipcc_co2, 0.001)
        agreement_ratio = max(0.0, min(1.0, agreement_ratio))
        # Better agreement → tighter bounds (up to 30% reduction)
        ensemble_unc = ipcc_unc * (1.0 - 0.3 * agreement_ratio)

    c_min = round(ensemble_co2 * (1.0 - ensemble_unc), 3)
    c_max = round(ensemble_co2 * (1.0 + ensemble_unc), 3)

    # Update MRV result
    ipcc_result.tonnes_co2_net = round(ensemble_co2, 3)
    ipcc_result.tonnes_co2_min = c_min
    ipcc_result.tonnes_co2_max = c_max
    ipcc_result.uncertainty_pct = round(ensemble_unc * 100, 1)
    ipcc_result.kgml_enabled = True
    ipcc_result.ensemble_weight_kgml = round(w_kgml, 2)

    # Only surface KGML values when confidence is meaningful (>10%)
    # Zero-confidence KGML on wrong land use would be misleading in response
    if kgml_conf > 10.0:
        ipcc_result.kgml_delta_soc = kgml_result["kgml_delta_soc"]
        ipcc_result.kgml_co2_net = kgml_result["kgml_co2_net"]
        ipcc_result.kgml_confidence = kgml_result["kgml_confidence"]
    else:
        log.warning("[ENSEMBLE] KGML confidence %.1f%% too low — suppressing kgml_co2_net from response",
                    kgml_conf)
        ipcc_result.kgml_delta_soc = None
        ipcc_result.kgml_co2_net = None
        ipcc_result.kgml_confidence = round(kgml_conf, 1)

    # Recalculate economic values
    price_min = settings.carbon_price_min
    price_max = settings.carbon_price_max
    lkr = settings.usd_to_lkr
    ipcc_result.value_usd_min = round(c_min * price_min, 2)
    ipcc_result.value_usd_max = round(c_max * price_max, 2)
    ipcc_result.value_lkr_min = round(c_min * price_min * lkr, 0)
    ipcc_result.value_lkr_max = round(c_max * price_max * lkr, 0)

    ipcc_result.methodology += f" | KGML-ag-Carbon ensemble (w={w_kgml:.0%})"

    log.info("[ENSEMBLE] IPCC=%.3f  KGML=%.3f  →  ensemble=%.3f  (w_kgml=%.0f%%  agreement=%.0f%%)",
             ipcc_co2, kgml_co2, ensemble_co2, w_kgml * 100, agreement_ratio * 100)

    return ipcc_result
