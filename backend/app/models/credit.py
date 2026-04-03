from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class MRVResult(SQLModel):
    """Output of the AI-MRV carbon calculation engine."""
    farm_id: Optional[int] = None
    crop_type: str
    land_area_ha: float
    tonnes_co2_net: float
    tonnes_co2_min: float  # lower bound at uncertainty range
    tonnes_co2_max: float  # upper bound at uncertainty range
    uncertainty_pct: float = 28.0  # Tier-2 default; 15.0 after satellite, 60.0 for Tier-1
    confidence_score: float  # 0–100
    value_usd_min: float
    value_usd_max: float
    value_lkr_min: float
    value_lkr_max: float
    methodology: str
    # IPCC 2019 SOC calculation details (Eq. 2.25)
    tier: str = "Tier-2"              # "Tier-1" | "Tier-2" | "Tier-2+Satellite"
    soc_ref_value: float = 0.0        # SOC_REF from Table 2.3 (t C ha⁻¹)
    delta_soc_annual: float = 0.0     # ΔSOC annual (t C ha⁻¹ yr⁻¹) before CO2 conversion
    climate_zone: str = ""            # e.g. "tropical_montane"
    soil_type: str = "HAC"
    # KGML model results (Liu et al. 2024 — KGML-ag-Carbon)
    kgml_delta_soc: Optional[float] = None      # KGML predicted ΔSOC (t C/ha/yr)
    kgml_co2_net: Optional[float] = None         # KGML predicted net CO2 (t CO2/yr)
    kgml_confidence: Optional[float] = None      # KGML MC-Dropout confidence (0-100)
    kgml_enabled: bool = False                    # True when KGML model was used
    ensemble_weight_kgml: Optional[float] = None  # Weight given to KGML in ensemble (0-1)
    # Satellite verification
    satellite_verified: bool = False
    satellite_ndvi_score: Optional[float] = None
    anomaly_flag: bool = False
    # Claim validity status — set by satellite verification
    # "VERIFIED"  : GEE confirmed land use matches claimed crop type
    # "UNVERIFIED": No GEE data available, result based on farmer's claim only
    # "SUSPICIOUS": GEE data available but NDVI below expected range (mild mismatch)
    # "REJECTED"  : GEE confirmed land use does NOT match claimed crop (NDVI mismatch)
    claim_status: str = "UNVERIFIED"
    claim_status_reason: Optional[str] = None
    calculated_at: datetime = Field(default_factory=datetime.utcnow)


class CreditToken(SQLModel, table=True):
    """On-chain carbon credit token record (mirrors blockchain state)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    token_id: Optional[int] = None  # ERC-1155 token ID on-chain
    farm_id: int
    farmer_address: str = Field(default="")
    tonnes_co2: float
    vintage: str  # year credit was generated, e.g. "2026"
    methodology: str = "Verra VMD0042"
    sat_hash: str = ""  # keccak256 of satellite verification data
    tx_hash: str = ""  # Polygon transaction hash of mint
    retired: bool = False
    retired_by: Optional[str] = None
    minted_at: datetime = Field(default_factory=datetime.utcnow)
    retired_at: Optional[datetime] = None


class PoolBundle(SQLModel):
    """Aggregated pool of credits ready for Verra submission."""
    total_farms: int
    total_tonnes_co2: float
    gross_value_usd: float
    platform_fee_usd: float
    shared_mrv_cost_usd: float
    net_to_farmers_usd: float
    net_to_farmers_lkr: float
    meets_verra_minimum: bool
    verra_minimum_tonnes: float = 10000.0
    pool_members: list[dict] = []
