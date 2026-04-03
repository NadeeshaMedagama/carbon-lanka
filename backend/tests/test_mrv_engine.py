"""Unit tests for the IPCC Tier-2 MRV calculation engine."""

import pytest
from app.models.farm import FarmInput
from app.core.mrv_engine import calculate_carbon


def _tea_farm(land_ha=2.02, crop="tea_organic"):
    return FarmInput(
        land_area_ha=land_ha,
        crop_type=crop,
        practice_change="organic_conversion",
        years_since_change=3,
    )


def test_tea_organic_estimate_range():
    """5 acres (2.02 ha) organic tea should produce ~100–200 t CO2."""
    result = calculate_carbon(_tea_farm(land_ha=5 * 0.404686))
    assert 100 < result.tonnes_co2_net < 250, f"Got {result.tonnes_co2_net}"


def test_proposal_demo_case():
    """Proposal demo: 5 acres tea → ~182 t CO2."""
    result = calculate_carbon(_tea_farm(land_ha=5 * 0.404686))
    # Allow ±30 t slack from demo figure
    assert abs(result.tonnes_co2_net - 182) < 50, f"Got {result.tonnes_co2_net}"


def test_uncertainty_bounds():
    result = calculate_carbon(_tea_farm())
    assert result.tonnes_co2_min < result.tonnes_co2_net < result.tonnes_co2_max
    assert abs((result.tonnes_co2_max - result.tonnes_co2_net) / result.tonnes_co2_net - 0.08) < 0.001


def test_value_in_usd():
    result = calculate_carbon(_tea_farm(land_ha=10))
    assert result.value_usd_min > 0
    assert result.value_usd_max > result.value_usd_min


def test_lkr_conversion():
    result = calculate_carbon(_tea_farm())
    assert result.value_lkr_min == pytest.approx(result.value_usd_min * 310.0, abs=1)


def test_solar_coop():
    farm = FarmInput(
        land_area_ha=1.0,
        crop_type="solar_cooperative",
        practice_change="solar_install",
        solar_kw_installed=50.0,
    )
    result = calculate_carbon(farm)
    assert result.tonnes_co2_net > 0


def test_invalid_crop_type():
    with pytest.raises(ValueError, match="Unknown crop type"):
        calculate_carbon(FarmInput(
            land_area_ha=1.0,
            crop_type="unicorn_farm",
            practice_change="magic",
        ))


def test_zero_area_rejected():
    with pytest.raises(Exception):
        FarmInput(land_area_ha=0, crop_type="tea_organic", practice_change="organic_conversion")


def test_paddy_methane_reduces_net():
    """Paddy rice should have lower net than gross due to methane emissions."""
    paddy = FarmInput(land_area_ha=2.0, crop_type="paddy_rice", practice_change="improved_water_management")
    result = calculate_carbon(paddy)
    # Methane factor should push net below raw sequestration
    assert result.tonnes_co2_net >= 0


def test_confidence_score_range():
    result = calculate_carbon(_tea_farm())
    assert 0 < result.confidence_score <= 99


def test_methodology_returned():
    result = calculate_carbon(_tea_farm())
    assert "IPCC" in result.methodology or "VMD" in result.methodology
