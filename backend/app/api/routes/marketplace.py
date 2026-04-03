from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
import hashlib
from datetime import datetime

from app.db.database import get_session
from app.models.credit import CreditToken
from app.models.farm import Farm
from app.models.transaction import BuyOrder, Transaction, PayoutDisplay
from app.config import settings

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

_PLATFORM_FEE_RATE = 0.06
_MRV_COST_SHARE_USD = 75.0  # shared MRV cost per farm (200 farms sharing $15K)


@router.get("")
async def list_listings(session: AsyncSession = Depends(get_session)) -> list[dict]:
    """List all available (non-retired) carbon credits for purchase."""
    tokens_result = await session.exec(
        select(CreditToken).where(CreditToken.retired == False)
    )
    tokens = tokens_result.all()

    listings = []
    for token in tokens:
        farm = await session.get(Farm, token.farm_id)
        price_usd = round(token.tonnes_co2 * (settings.carbon_price_min + settings.carbon_price_max) / 2, 2)
        listings.append({
            "token_id": token.token_id,
            "farm_id": token.farm_id,
            "farmer_name": farm.farmer_name if farm else "Unknown",
            "district": farm.district if farm else "",
            "crop_type": token.methodology,
            "tonnes_co2": token.tonnes_co2,
            "vintage": token.vintage,
            "methodology": token.methodology,
            "price_usd": price_usd,
            "price_per_tonne_usd": (settings.carbon_price_min + settings.carbon_price_max) / 2,
            "price_lkr": round(price_usd * settings.usd_to_lkr, 0),
            "tx_hash": token.tx_hash,
            "block_explorer_url": f"https://mumbai.polygonscan.com/tx/{token.tx_hash}",
        })

    return listings


@router.post("/buy", response_model=PayoutDisplay)
async def buy_credit(
    order: BuyOrder,
    session: AsyncSession = Depends(get_session),
) -> PayoutDisplay:
    """
    Purchase a carbon credit token.

    Simulates the on-chain ERC-1155 transfer and retirement flow.
    Returns payout breakdown showing farmer's net LKR income.
    """
    # Find token
    result = await session.exec(
        select(CreditToken).where(
            CreditToken.token_id == order.token_id,
            CreditToken.retired == False,
        )
    )
    token = result.first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found or already retired")

    farm = await session.get(Farm, token.farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Calculate payout
    gross_usd = token.tonnes_co2 * order.price_usd
    platform_fee = round(gross_usd * _PLATFORM_FEE_RATE, 2)
    net_usd = round(gross_usd - platform_fee - _MRV_COST_SHARE_USD, 2)
    net_lkr = round(net_usd * settings.usd_to_lkr, 0)

    # Simulate retirement tx hash
    retire_seed = f"retire:{order.token_id}:{order.buyer_address}:{datetime.utcnow()}"
    retire_tx = "0x" + hashlib.sha256(retire_seed.encode()).hexdigest()

    # Mark token as retired
    token.retired = True
    token.retired_by = order.buyer_address
    token.retired_at = datetime.utcnow()
    session.add(token)

    # Record transaction
    txn = Transaction(
        token_id=order.token_id,
        farm_id=token.farm_id,
        seller_address=token.farmer_address,
        buyer_address=order.buyer_address,
        price_usd=order.price_usd * token.tonnes_co2,
        price_lkr=round(order.price_usd * token.tonnes_co2 * settings.usd_to_lkr, 0),
        platform_fee_usd=platform_fee,
        farmer_payout_usd=net_usd,
        farmer_payout_lkr=net_lkr,
        tx_hash=retire_tx,
    )
    session.add(txn)
    await session.commit()

    return PayoutDisplay(
        token_id=order.token_id,
        farmer_name=farm.farmer_name,
        tonnes_co2=token.tonnes_co2,
        gross_usd=round(gross_usd, 2),
        platform_fee_usd=platform_fee,
        mrv_cost_share_usd=_MRV_COST_SHARE_USD,
        net_usd=net_usd,
        net_lkr=net_lkr,
        tx_hash=retire_tx,
        block_explorer_url=f"https://mumbai.polygonscan.com/tx/{retire_tx}",
    )
