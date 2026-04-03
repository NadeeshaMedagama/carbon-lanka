from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class BuyOrder(SQLModel):
    """Marketplace purchase request."""
    token_id: int
    buyer_address: str
    price_usd: float
    retire_tx_hash: str = ""  # real on-chain retire() tx hash (empty for simulated mode)


class Transaction(SQLModel, table=True):
    """Completed marketplace transaction."""
    id: Optional[int] = Field(default=None, primary_key=True)
    token_id: int
    farm_id: int
    seller_address: str
    buyer_address: str
    price_usd: float
    price_lkr: float
    platform_fee_usd: float
    farmer_payout_usd: float
    farmer_payout_lkr: float
    tx_hash: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PayoutDisplay(SQLModel):
    """Farmer payout summary shown in the UI."""
    token_id: int
    farmer_name: str
    tonnes_co2: float
    gross_usd: float
    platform_fee_usd: float
    mrv_cost_share_usd: float
    net_usd: float
    net_lkr: float
    tx_hash: str
    block_explorer_url: str
