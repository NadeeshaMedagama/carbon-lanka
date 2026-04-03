from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class MRVResult(SQLModel):
    """Output of the AI-MRV carbon calculation engine."""
    farm_id: Optional[int] = None
    crop_type: str
    land_area_ha: float
    tonnes_co2_net: float
    tonnes_co2_min: float  # lower bound at ±8% uncertainty
    tonnes_co2_max: float  # upper bound at ±8% uncertainty
    uncertainty_pct: float = 8.0
    confidence_score: float  # 0–100
    value_usd_min: float
    value_usd_max: float
    value_lkr_min: float
    value_lkr_max: float
    methodology: str
    satellite_verified: bool = False
    satellite_ndvi_score: Optional[float] = None
    anomaly_flag: bool = False
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    retired_amount: float = 0.0  # cumulative tonnes retired (supports partial retirement)
    retired_by: Optional[str] = None
    minted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    retired_at: Optional[datetime] = None
    on_chain: bool = False  # true if minted via real blockchain (not simulated)


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
