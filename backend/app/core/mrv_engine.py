"""
AI-MRV Carbon Measurement Engine
==================================
Implements IPCC Tier-2 emission factor methodology for farm-level
carbon sequestration estimation.

Reference:
  IPCC (2019). 2019 Refinement to the 2006 IPCC Guidelines for National
  Greenhouse Gas Inventories. Volume 4: Agriculture, Forestry and Other Land Use.
  https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol4.html

Formula:
  C_net = C_sequestered - C_emitted  ±  σ_uncertainty
  where σ ≈ ±8% for Tier-2 calculations (IPCC 2019, Chapter 2.3)
"""

import json
from pathlib import Path
from datetime import datetime

from app.models.farm import FarmInput
from app.models.credit import MRVResult
from app.config import settings


_EF_PATH = Path(__file__).parent.parent / "data" / "ipcc_emission_factors.json"
_UNCERTAINTY = 0.08   # ±8% IPCC Tier-2 standard uncertainty
_CONFIDENCE_BASE = 92.0

# Litres of diesel → tonnes CO2 (IPCC 2006 Vol.2 Table 3.2.1)
_DIESEL_CO2_FACTOR = 0.002676  # t CO2 per litre
# kg synthetic N fertiliser → tonnes N2O-CO2e (IPCC 2006 Table 11.1 EF1=0.01 × 298 GWP)
_FERTILISER_CO2E_FACTOR = 0.00298  # t CO2e per kg N fertiliser


def _load_emission_factors() -> dict:
    with open(_EF_PATH, "r") as f:
        return json.load(f)


def calculate_carbon(farm: FarmInput) -> MRVResult:
    """
    Calculate net carbon sequestration for a farm using IPCC Tier-2 methodology.

    Returns MRVResult with tonnes CO2, value ranges, confidence score,
    and methodology reference.
    """
    efs = _load_emission_factors()

    if farm.crop_type not in efs:
        supported = [k for k in efs if not k.startswith("_")]
        raise ValueError(
            f"Unknown crop type '{farm.crop_type}'. "
            f"Supported types: {supported}"
        )

    ef = efs[farm.crop_type]

    # ── Step 1: Gross sequestration ──────────────────────────────────────
    if farm.crop_type == "solar_cooperative":
        # Solar: displacement credits (no sequestration, avoidance credits)
        kw = farm.solar_kw_installed or (farm.land_area_ha * 500)  # ~500 kW/ha estimate
        kwh_annual = kw * ef["avg_annual_kwh_per_kw"]
        c_sequestered = kwh_annual * ef["displacement_factor_t_kwh"]
    else:
        # Agricultural / forestry: area × sequestration factor
        c_sequestered = farm.land_area_ha * ef["sequestration_factor_t_ha_yr"]

        # Apply practice bonus for organic/agroforestry changes
        if "organic" in farm.practice_change or farm.practice_change in (
            "agroforestry_adoption", "forest_regen"
        ):
            c_sequestered *= ef.get("practice_bonus_organic", 1.0)

    # ── Step 2: Emissions from inputs ────────────────────────────────────
    # Fertiliser N2O emissions
    c_fertiliser = farm.fertiliser_kg_ha_yr * farm.land_area_ha * _FERTILISER_CO2E_FACTOR
    # Override with IPCC EF if no user-supplied fertiliser data
    if farm.fertiliser_kg_ha_yr == 0.0:
        c_fertiliser = farm.land_area_ha * ef.get("emission_factor_fertiliser_t_ha_yr", 0.0)

    # Fuel combustion emissions
    c_fuel = farm.fuel_litres_yr * _DIESEL_CO2_FACTOR
    if farm.fuel_litres_yr == 0.0:
        c_fuel = farm.land_area_ha * ef.get("emission_factor_fuel_t_ha_yr", 0.0)

    # Methane from paddy rice
    c_methane = farm.land_area_ha * ef.get("emission_factor_methane_t_ha_yr", 0.0)

    c_emitted = c_fertiliser + c_fuel + c_methane

    # ── Step 3: Net sequestration with uncertainty ────────────────────────
    c_net = max(0.0, c_sequestered - c_emitted)
    c_min = c_net * (1 - _UNCERTAINTY)
    c_max = c_net * (1 + _UNCERTAINTY)

    # ── Step 4: Economic valuation ────────────────────────────────────────
    price_min = settings.carbon_price_min
    price_max = settings.carbon_price_max
    lkr = settings.usd_to_lkr

    value_usd_min = round(c_min * price_min, 2)
    value_usd_max = round(c_max * price_max, 2)
    value_lkr_min = round(value_usd_min * lkr, 0)
    value_lkr_max = round(value_usd_max * lkr, 0)

    # ── Step 5: Confidence score ──────────────────────────────────────────
    # Reduce confidence if data is sparse (using defaults)
    confidence = _CONFIDENCE_BASE
    if farm.fertiliser_kg_ha_yr == 0.0:
        confidence -= 2.0
    if farm.fuel_litres_yr == 0.0:
        confidence -= 1.5
    confidence = round(min(confidence, 99.0), 1)

    return MRVResult(
        crop_type=farm.crop_type,
        land_area_ha=farm.land_area_ha,
        tonnes_co2_net=round(c_net, 2),
        tonnes_co2_min=round(c_min, 2),
        tonnes_co2_max=round(c_max, 2),
        uncertainty_pct=_UNCERTAINTY * 100,
        confidence_score=confidence,
        value_usd_min=value_usd_min,
        value_usd_max=value_usd_max,
        value_lkr_min=value_lkr_min,
        value_lkr_max=value_lkr_max,
        methodology=ef.get("methodology", "IPCC Tier-2"),
        calculated_at=datetime.utcnow(),
    )
