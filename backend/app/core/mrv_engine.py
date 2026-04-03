"""
AI-MRV Carbon Measurement Engine
==================================
Implements IPCC 2019 Equation 2.25 SOC stock-change methodology for
farm-level carbon sequestration estimation.

Reference:
  IPCC (2019). 2019 Refinement to the 2006 IPCC Guidelines for National
  Greenhouse Gas Inventories. Volume 4: Agriculture, Forestry and Other
  Land Use. Chapter 2: Generic Methodologies Applicable to Multiple
  Land-Use Categories.
  https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol4.html

Core formula (Eq. 2.25):
  SOC_new      = SOC_REF × F_LU × F_MG_new × F_I_new
  SOC_baseline = SOC_REF × F_LU × F_MG_base × F_I_base
  ΔSOC_annual  = (SOC_new − SOC_baseline) / D          [t C ha⁻¹ yr⁻¹]
  C_seq        = ΔSOC_annual × (44/12) × land_area_ha  [t CO2 yr⁻¹]

  where D = 20 years (default equilibration period, IPCC 2019 §2.3.3.1)

Tier uncertainty (IPCC 2019 Table 2.5):
  Tier-1              ±60%   (no local data, district not mapped)
  Tier-2              ±28%   (IPCC Tier-2 with local climate zone data)
  Tier-2+Satellite    ±15%   (Tier-2 corroborated by Sentinel-2 NDVI trend)

Additional references used in this implementation:
  Lasaponara et al. (2022). Remote Sensing, 14(19), 4723.
    → NDVI trend analysis for land-use change detection; justifies satellite tier upgrade.
  Liu et al. (2024). Nature Communications, 15, 197 (KGML-ag-Carbon).
    → Mass balance ΔSOC = −NEE − Yield; validates 20-year SOC equilibration.
"""

import json
import logging
from pathlib import Path
from datetime import datetime

from app.models.farm import FarmInput
from app.models.credit import MRVResult
from app.config import settings
from app.data_loader import load_soc_factors

log = logging.getLogger("carbonlanka.mrv")


# Fallback values when district / soil type not in JSON mapping
_DEFAULT_CLIMATE_ZONE = "tropical_moist"
_DEFAULT_SOIL_TYPE    = "HAC"


def _get_factor_value(factor_table: dict, key: str, factor_name: str) -> float:
    """Extract the numeric value from a factor entry like {"value": 1.08, "note": "..."}"""
    entry = factor_table.get(key)
    if entry is None:
        raise ValueError(
            f"Unknown {factor_name} key '{key}'. "
            f"Valid keys: {[k for k in factor_table if not k.startswith('_')]}"
        )
    return entry["value"] if isinstance(entry, dict) else float(entry)


def calculate_carbon(farm: FarmInput) -> MRVResult:
    """
    Calculate net carbon sequestration for a farm using IPCC 2019 Eq. 2.25.

    Returns MRVResult with:
      - tonnes_co2_net: best estimate
      - tonnes_co2_min/max: uncertainty bounds
      - tier: methodology tier (Tier-1 / Tier-2 / Tier-2+Satellite)
      - soc_ref_value, delta_soc_annual, climate_zone, soil_type: audit trail
    """
    soc_data = load_soc_factors()

    # ── Load physical constants from JSON (single source of truth) ───────────
    ef          = soc_data["emission_factors"]
    soc_calc    = soc_data["soc_calculation"]
    diesel_factor       = ef["diesel_co2_t_per_litre"]
    fertiliser_factor   = ef["fertiliser_n2o_co2e_t_per_kg_n"]
    equilibration_years = soc_calc["equilibration_years"]
    c_to_co2            = soc_calc["c_to_co2_ratio"]
    confidence_reduction = ef["confidence_reduction_no_fertiliser_data"]
    confidence_floor     = ef["min_confidence_floor"]

    log.info("--- MRV START  crop=%-22s  area=%.2f ha  district=%s  soil=%s",
             farm.crop_type, farm.land_area_ha,
             farm.district or "(none)", farm.soil_type or _DEFAULT_SOIL_TYPE)

    # ── 1. Resolve climate zone and soil type ────────────────────────────────
    district = farm.district or ""
    climate_zone = soc_data["district_climate_zone"].get(district, None)
    tier = "Tier-2" if climate_zone else "Tier-1"
    if climate_zone is None:
        climate_zone = _DEFAULT_CLIMATE_ZONE
        log.warning("  [1] District '%s' not in mapping → fallback to %s  (Tier-1, ±60%%)",
                    district, climate_zone)
    else:
        log.info("  [1] District '%s' → climate_zone=%s  tier=%s", district, climate_zone, tier)

    soil_type = farm.soil_type if farm.soil_type else _DEFAULT_SOIL_TYPE

    # ── 2. Special case: solar cooperative (energy displacement, not SOC) ───
    if farm.crop_type == "solar_cooperative":
        log.info("  [2] Solar cooperative — using energy displacement method (not SOC)")
        return _calculate_solar(farm, soc_data, tier, climate_zone, soil_type)

    # ── 3. Validate crop type ────────────────────────────────────────────────
    known_crops = [k for k in soc_data["crop_f_lu"] if not k.startswith("_")]
    if farm.crop_type not in known_crops:
        raise ValueError(
            f"Unknown crop type '{farm.crop_type}'. Supported: {known_crops}"
        )

    # ── 4. Look up SOC_REF (Table 2.3) ──────────────────────────────────────
    soc_ref_zone = soc_data["soc_ref"].get(climate_zone, soc_data["soc_ref"][_DEFAULT_CLIMATE_ZONE])
    soc_ref = soc_ref_zone.get(soil_type, soc_ref_zone[_DEFAULT_SOIL_TYPE])
    log.info("  [4] SOC_REF  zone=%-18s  soil=%-8s  SOC_REF=%.1f t C/ha",
             climate_zone, soil_type, soc_ref)

    # ── 5. Look up F_LU ──────────────────────────────────────────────────────
    f_lu_key = soc_data["crop_f_lu"][farm.crop_type]
    f_lu = _get_factor_value(soc_data["f_lu"], f_lu_key, "F_LU")
    log.info("  [5] F_LU     %-25s  = %.4f", f_lu_key, f_lu)

    # ── 6. Look up F_MG (new practice vs baseline) ──────────────────────────
    f_mg_new_key = farm.practice_change
    f_mg_base_key = soc_data["baseline_f_mg"][farm.crop_type]

    # Gracefully fall back to conventional_management if practice_change not in table
    if f_mg_new_key not in soc_data["f_mg"] or f_mg_new_key.startswith("_"):
        log.warning("  [6] practice_change '%s' not in F_MG table → using conventional_management",
                    f_mg_new_key)
        f_mg_new_key = "conventional_management"

    f_mg_new  = _get_factor_value(soc_data["f_mg"], f_mg_new_key, "F_MG_new")
    f_mg_base = _get_factor_value(soc_data["f_mg"], f_mg_base_key, "F_MG_base")
    log.info("  [6] F_MG     new=%-28s = %.4f  |  base=%-28s = %.4f",
             f_mg_new_key, f_mg_new, f_mg_base_key, f_mg_base)

    # ── 7. Look up F_I (new practice vs baseline) ────────────────────────────
    f_i_new_key  = soc_data["crop_f_i_new"][farm.crop_type]
    f_i_base_key = soc_data["baseline_f_i"][farm.crop_type]

    f_i_new  = _get_factor_value(soc_data["f_i"], f_i_new_key, "F_I_new")
    f_i_base = _get_factor_value(soc_data["f_i"], f_i_base_key, "F_I_base")
    log.info("  [7] F_I      new=%-10s = %.4f  |  base=%-10s = %.4f",
             f_i_new_key, f_i_new, f_i_base_key, f_i_base)

    # ── 8. IPCC Eq. 2.25 — SOC stock-change calculation ─────────────────────
    soc_new      = soc_ref * f_lu * f_mg_new  * f_i_new
    soc_baseline = soc_ref * f_lu * f_mg_base * f_i_base

    # Annual ΔSOC (t C ha⁻¹ yr⁻¹) over equilibration period (from JSON)
    delta_soc_annual = (soc_new - soc_baseline) / equilibration_years

    # Convert from C to CO2 and scale to farm area
    c_seq = delta_soc_annual * c_to_co2 * farm.land_area_ha  # t CO2 yr⁻¹

    log.info("  [8] IPCC Eq.2.25  SOC_new=%.3f  SOC_base=%.3f  delta_SOC=%.4f t C/ha/yr  (D=%d yr)",
             soc_new, soc_baseline, delta_soc_annual, equilibration_years)
    log.info("       C->CO2: %.4f * %.4f * %.2f ha = %.4f t CO2/yr (gross)",
             delta_soc_annual, c_to_co2, farm.land_area_ha, c_seq)

    # ── 9. Emission deductions ───────────────────────────────────────────────
    # Fertiliser N2O (factor from JSON)
    if farm.fertiliser_kg_ha_yr > 0.0:
        c_fertiliser = farm.fertiliser_kg_ha_yr * farm.land_area_ha * fertiliser_factor
    else:
        c_fertiliser = 0.0

    # Fossil fuel combustion (factor from JSON)
    if farm.fuel_litres_yr > 0.0:
        c_fuel = farm.fuel_litres_yr * diesel_factor
    else:
        c_fuel = 0.0

    # Paddy rice CH4 (Tier-2, IPCC 2006 Vol.4 Chapter 5)
    if farm.crop_type == "paddy_rice":
        c_methane = farm.land_area_ha * soc_data["paddy_methane"]["emission_factor_t_co2e_ha_yr"]
    else:
        c_methane = 0.0

    c_emitted = c_fertiliser + c_fuel + c_methane
    log.info("  [9] Emissions  fertiliser=%.4f  fuel=%.4f  methane=%.4f  total=%.4f t CO2",
             c_fertiliser, c_fuel, c_methane, c_emitted)

    # ── 10. Net sequestration ─────────────────────────────────────────────────
    c_net = max(0.0, c_seq - c_emitted)
    log.info("  [10] NET = %.4f - %.4f = %.4f t CO2/yr", c_seq, c_emitted, c_net)

    # ── 11. Tier-based uncertainty ────────────────────────────────────────────
    uncertainty_pct = soc_data["tier_uncertainty"][tier]
    confidence      = soc_data["tier_confidence"][tier]

    # Reduce confidence if fertiliser not reported for non-organic crops (from JSON)
    if farm.fertiliser_kg_ha_yr == 0.0 and farm.crop_type not in ("tea_organic", "forest_regen", "coconut_organic"):
        confidence = max(confidence - confidence_reduction, confidence_floor)

    c_min = c_net * (1.0 - uncertainty_pct / 100.0)
    c_max = c_net * (1.0 + uncertainty_pct / 100.0)
    log.info("  [11] %s  uncertainty=+-%.0f%%  confidence=%.1f  range=[%.3f, %.3f]",
             tier, uncertainty_pct, confidence, c_min, c_max)

    # ── 12. Economic valuation ─────────────────────────────────────────────────
    price_min = settings.carbon_price_min
    price_max = settings.carbon_price_max
    lkr       = settings.usd_to_lkr

    value_usd_min = round(c_min * price_min, 2)
    value_usd_max = round(c_max * price_max, 2)
    value_lkr_min = round(value_usd_min * lkr, 0)
    value_lkr_max = round(value_usd_max * lkr, 0)

    methodology = f"IPCC 2019 Eq. 2.25 SOC stock-change | {tier} | {climate_zone} | Verra VMD0042 IALM"

    log.info("  [12] VALUE  USD=[%.2f, %.2f]  LKR=[%.0f, %.0f]",
             round(c_min * settings.carbon_price_min, 2),
             round(c_max * settings.carbon_price_max, 2),
             round(c_min * settings.carbon_price_min * settings.usd_to_lkr, 0),
             round(c_max * settings.carbon_price_max * settings.usd_to_lkr, 0))
    log.info("--- MRV END   result=%.3f t CO2  tier=%s  confidence=%.1f%%",
             c_net, tier, confidence)

    return MRVResult(
        crop_type=farm.crop_type,
        land_area_ha=farm.land_area_ha,
        tonnes_co2_net=round(c_net, 3),
        tonnes_co2_min=round(c_min, 3),
        tonnes_co2_max=round(c_max, 3),
        uncertainty_pct=uncertainty_pct,
        confidence_score=round(confidence, 1),
        value_usd_min=value_usd_min,
        value_usd_max=value_usd_max,
        value_lkr_min=value_lkr_min,
        value_lkr_max=value_lkr_max,
        methodology=methodology,
        tier=tier,
        soc_ref_value=round(soc_ref, 2),
        delta_soc_annual=round(delta_soc_annual, 4),
        climate_zone=climate_zone,
        soil_type=soil_type,
        calculated_at=datetime.utcnow(),
    )


def _calculate_solar(
    farm: FarmInput,
    soc_data: dict,
    tier: str,
    climate_zone: str,
    soil_type: str,
) -> MRVResult:
    """
    Energy displacement credits for solar co-operatives.
    Not SOC-based — uses grid emission factor approach (IPCC Tier-1 Energy).
    """
    soc_data = load_soc_factors()
    sf = soc_data["solar_factors"]
    kw = farm.solar_kw_installed or (farm.land_area_ha * settings.solar_default_kw_per_ha)
    kwh_annual = kw * sf["avg_annual_kwh_per_kw"]
    c_net = kwh_annual * sf["displacement_factor_t_co2_per_kwh"]

    log.info("  [SOLAR] capacity=%.1f kW  kwh_annual=%.0f  factor=%s t CO2/kWh",
             kw, kwh_annual, sf["displacement_factor_t_co2_per_kwh"])

    # Solar always Tier-1 for energy displacement
    solar_tier = "Tier-1"
    uncertainty_pct = soc_data["tier_uncertainty"][solar_tier]
    confidence      = soc_data["tier_confidence"][solar_tier]

    c_min = c_net * (1.0 - uncertainty_pct / 100.0)
    c_max = c_net * (1.0 + uncertainty_pct / 100.0)

    price_min = settings.carbon_price_min
    price_max = settings.carbon_price_max
    lkr       = settings.usd_to_lkr

    log.info("  [SOLAR] co2_net=%.3f t  uncertainty=+-%.0f%%  USD=[%.2f, %.2f]  LKR=[%.0f, %.0f]",
             c_net, uncertainty_pct,
             round(c_min * price_min, 2), round(c_max * price_max, 2),
             round(c_min * price_min * lkr, 0), round(c_max * price_max * lkr, 0))
    log.info("--- MRV END   result=%.3f t CO2  tier=%s  (solar cooperative)", c_net, solar_tier)

    return MRVResult(
        crop_type="solar_cooperative",
        land_area_ha=farm.land_area_ha,
        tonnes_co2_net=round(c_net, 3),
        tonnes_co2_min=round(c_min, 3),
        tonnes_co2_max=round(c_max, 3),
        uncertainty_pct=uncertainty_pct,
        confidence_score=round(confidence, 1),
        value_usd_min=round(c_min * price_min, 2),
        value_usd_max=round(c_max * price_max, 2),
        value_lkr_min=round(c_min * price_min * lkr, 0),
        value_lkr_max=round(c_max * price_max * lkr, 0),
        methodology=sf["methodology"],
        tier=solar_tier,
        soc_ref_value=0.0,
        delta_soc_annual=0.0,
        climate_zone=climate_zone,
        soil_type=soil_type,
        calculated_at=datetime.utcnow(),
    )
