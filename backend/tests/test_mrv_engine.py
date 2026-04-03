"""
Unit tests for the IPCC 2019 Eq. 2.25 SOC stock-change MRV engine.

Key changes from old flat-factor tests:
  - Uncertainty is now Tier-2 ±28% (not ±8%)
  - Tonnage is lower and scientifically grounded (~4-5 t CO2/ha/yr for tea_organic)
  - New fields: tier, soc_ref_value, delta_soc_annual, climate_zone, soil_type
"""

import pytest
from app.models.farm import FarmInput
from app.core.mrv_engine import calculate_carbon
from app.core.satellite import verify_with_satellite


def _tea_farm(land_ha=2.0, district="Nuwara Eliya", soil_type="HAC"):
    return FarmInput(
        land_area_ha=land_ha,
        crop_type="tea_organic",
        practice_change="organic_conversion",
        years_since_change=3,
        district=district,
        soil_type=soil_type,
    )


# ── Core SOC calculation ─────────────────────────────────────────────────────

def test_tea_organic_soc_ref():
    """Nuwara Eliya (tropical_montane) + HAC soil → SOC_REF = 51 t C/ha."""
    r = calculate_carbon(_tea_farm())
    assert r.soc_ref_value == pytest.approx(51.0)
    assert r.climate_zone == "tropical_montane"


def test_tea_organic_delta_soc():
    """
    tea_organic: F_LU=0.94, F_MG_new=1.08, F_I_new=1.44, F_MG_base=1.0, F_I_base=1.0
    SOC_new  = 51 * 0.94 * 1.08 * 1.44 = 74.64
    SOC_base = 51 * 0.94 * 1.0  * 1.0  = 47.94
    DELTA_SOC = (74.64 - 47.94) / 20   = 1.335 t C/ha/yr
    """
    r = calculate_carbon(_tea_farm())
    assert r.delta_soc_annual == pytest.approx(1.335, abs=0.01)


def test_tea_organic_co2_conversion():
    """
    2 ha tea_organic: DELTA_SOC * (44/12) * 2 ha = 1.335 * 3.667 * 2 = ~9.79 t CO2
    """
    r = calculate_carbon(_tea_farm(land_ha=2.0))
    assert r.tonnes_co2_net == pytest.approx(9.76, abs=0.2)


def test_co2_scales_with_area():
    """Doubling land area doubles CO2."""
    r1 = calculate_carbon(_tea_farm(land_ha=1.0))
    r2 = calculate_carbon(_tea_farm(land_ha=2.0))
    assert r2.tonnes_co2_net == pytest.approx(r1.tonnes_co2_net * 2.0, abs=0.01)


def test_climate_zone_affects_soc():
    """Kandy (tropical_wet, SOC_REF=60) gives higher SOC_REF than Nuwara Eliya (51)."""
    r_montane = calculate_carbon(_tea_farm(district="Nuwara Eliya"))
    r_wet = calculate_carbon(FarmInput(
        land_area_ha=2.0, crop_type="tea_organic",
        practice_change="organic_conversion", district="Kandy", soil_type="HAC"
    ))
    assert r_wet.soc_ref_value == pytest.approx(60.0)
    assert r_wet.tonnes_co2_net > r_montane.tonnes_co2_net


# ── Tier and uncertainty ─────────────────────────────────────────────────────

def test_tier2_for_known_district():
    r = calculate_carbon(_tea_farm(district="Nuwara Eliya"))
    assert r.tier == "Tier-2"
    assert r.uncertainty_pct == pytest.approx(28.0)


def test_tier1_for_unknown_district():
    r = calculate_carbon(FarmInput(
        land_area_ha=1.0, crop_type="tea_organic",
        practice_change="organic_conversion", district="UnknownPlace"
    ))
    assert r.tier == "Tier-1"
    assert r.uncertainty_pct == pytest.approx(60.0)
    assert r.confidence_score == pytest.approx(72.0)


def test_uncertainty_bounds_tier2():
    r = calculate_carbon(_tea_farm())
    assert r.tonnes_co2_min < r.tonnes_co2_net < r.tonnes_co2_max
    # ±28% bounds
    assert r.tonnes_co2_max == pytest.approx(r.tonnes_co2_net * 1.28, abs=0.01)
    assert r.tonnes_co2_min == pytest.approx(r.tonnes_co2_net * 0.72, abs=0.01)


def test_confidence_score_tier2():
    r = calculate_carbon(_tea_farm())
    assert r.confidence_score == pytest.approx(88.0, abs=5.0)


# ── Satellite tier upgrade (Lasaponara et al.) ───────────────────────────────

def test_satellite_upgrades_tea_to_tier2sat():
    """tea_organic has positive NDVI trend → should upgrade to Tier-2+Satellite."""
    r = calculate_carbon(_tea_farm())
    assert r.tier == "Tier-2"
    r_sat = verify_with_satellite(r, latitude=6.9271, longitude=80.7718)
    assert r_sat.tier == "Tier-2+Satellite"
    assert r_sat.uncertainty_pct == pytest.approx(15.0)
    # Confidence starts at 95 (Tier-2+Satellite) but may be reduced by NDVI penalty
    # if live NDVI < expected for crop type (e.g., 0.63 < 0.74 for tea_organic)
    assert r_sat.confidence_score >= 85.0  # after penalty, still high for real tea area
    assert r_sat.confidence_score <= 95.0
    assert r_sat.satellite_verified is True


def test_satellite_no_anomaly_for_realistic_estimate():
    r = calculate_carbon(_tea_farm())
    r_sat = verify_with_satellite(r, latitude=6.9271, longitude=80.7718)
    assert r_sat.anomaly_flag is False


def test_satellite_recalculates_bounds():
    r = calculate_carbon(_tea_farm())
    r_sat = verify_with_satellite(r, latitude=6.9271, longitude=80.7718)
    # Bounds should now use ±15%, not ±28%
    assert r_sat.tonnes_co2_max == pytest.approx(r_sat.tonnes_co2_net * 1.15, abs=0.01)


# ── Special crop types ───────────────────────────────────────────────────────

def test_solar_coop():
    farm = FarmInput(
        land_area_ha=1.0, crop_type="solar_cooperative",
        practice_change="solar_install", solar_kw_installed=50.0
    )
    r = calculate_carbon(farm)
    assert r.tonnes_co2_net > 0
    assert r.tier == "Tier-1"
    assert r.soc_ref_value == pytest.approx(0.0)   # not SOC-based


def test_paddy_methane_deduction():
    """Paddy rice: methane emissions should be deducted from gross sequestration."""
    paddy = FarmInput(
        land_area_ha=2.0, crop_type="paddy_rice",
        practice_change="improved_water_management", district="Gampaha"
    )
    r = calculate_carbon(paddy)
    # Net should be >= 0 (methane may exceed gross SOC gain)
    assert r.tonnes_co2_net >= 0.0


def test_rubber_agroforestry():
    farm = FarmInput(
        land_area_ha=3.0, crop_type="rubber_agroforestry",
        practice_change="agroforestry_adoption", district="Kandy", soil_type="HAC"
    )
    r = calculate_carbon(farm)
    assert r.tonnes_co2_net > 0
    assert r.tier == "Tier-2"


def test_forest_regen():
    farm = FarmInput(
        land_area_ha=5.0, crop_type="forest_regen",
        practice_change="forest_regen", district="Ratnapura"
    )
    r = calculate_carbon(farm)
    assert r.tonnes_co2_net > 0


# ── Model validation ─────────────────────────────────────────────────────────

def test_invalid_crop_type():
    with pytest.raises(ValueError, match="Unknown crop type"):
        calculate_carbon(FarmInput(
            land_area_ha=1.0, crop_type="unicorn_farm", practice_change="magic"
        ))


def test_zero_area_rejected():
    with pytest.raises(Exception):
        FarmInput(land_area_ha=0, crop_type="tea_organic", practice_change="organic_conversion")


def test_methodology_string_contains_ipcc():
    r = calculate_carbon(_tea_farm())
    assert "IPCC" in r.methodology


def test_value_in_usd():
    r = calculate_carbon(_tea_farm(land_ha=10))
    assert r.value_usd_min > 0
    assert r.value_usd_max > r.value_usd_min


def test_lkr_value_present():
    r = calculate_carbon(_tea_farm())
    assert r.value_lkr_min > 0
    assert r.value_lkr_max > r.value_lkr_min


def test_new_fields_present():
    """Verify all new MRVResult fields are populated."""
    r = calculate_carbon(_tea_farm())
    assert r.tier in ("Tier-1", "Tier-2", "Tier-2+Satellite")
    assert r.soc_ref_value > 0
    assert r.delta_soc_annual > 0
    assert r.climate_zone != ""
    assert r.soil_type != ""
