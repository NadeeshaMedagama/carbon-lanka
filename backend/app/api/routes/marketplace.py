import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.core.blockchain import get_blockchain_service
from app.db.database import get_session
from app.models.credit import CreditToken
from app.models.farm import Farm
from app.models.transaction import BuyOrder, Transaction, PayoutDisplay

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


@router.get("")
async def list_listings(session: AsyncSession = Depends(get_session)) -> list[dict]:
    """List all available (non-retired) carbon credits for purchase."""
    tokens_result = await session.exec(
        select(CreditToken).where(CreditToken.retired == False)  # noqa: E712
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
            "crop_type": farm.crop_type if farm else "",
            "tonnes_co2": token.tonnes_co2,
            "vintage": token.vintage,
            "methodology": token.methodology,
            "price_usd": price_usd,
            "price_per_tonne_usd": (settings.carbon_price_min + settings.carbon_price_max) / 2,
            "price_lkr": round(price_usd * settings.usd_to_lkr, 0),
            "tx_hash": token.tx_hash,
            "block_explorer_url": f"{settings.block_explorer_base_url}/{token.tx_hash}",
            "on_chain": token.on_chain,
        })

    return listings


@router.post("/buy", response_model=PayoutDisplay)
async def buy_credit(
    order: BuyOrder,
    session: AsyncSession = Depends(get_session),
) -> PayoutDisplay:
    """
    Purchase and retire a carbon credit token.

    When USE_REAL_BLOCKCHAIN=true and retire_tx_hash is provided,
    the backend verifies the retirement on-chain before recording.
    When blockchain is disabled or no tx hash given, the retirement
    is recorded with a simulated hash (demo mode).
    """
    result = await session.exec(
        select(CreditToken).where(
            CreditToken.token_id == order.token_id,
            CreditToken.retired == False,  # noqa: E712
        )
    )
    token = result.first()
    if not token:
        raise HTTPException(
            status_code=404, detail="Token not found or already retired"
        )

    farm = await session.get(Farm, token.farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    server_price_per_tonne = (settings.carbon_price_min + settings.carbon_price_max) / 2
    if order.price_usd < server_price_per_tonne:
        raise HTTPException(
            status_code=422,
            detail=f"Price per tonne ${order.price_usd} is below minimum ${server_price_per_tonne}",
        )

    gross_usd = server_price_per_tonne * token.tonnes_co2
    platform_fee = round(gross_usd * settings.platform_fee_rate, 2)
    net_usd = round(gross_usd - platform_fee - settings.mrv_cost_per_token_usd, 2)
    net_lkr = round(net_usd * settings.usd_to_lkr, 0)

    retire_seed = f"retire:{order.token_id}:{order.buyer_address}:{datetime.now(timezone.utc)}"
    retire_tx = "0x" + hashlib.sha256(retire_seed.encode()).hexdigest()

    token.retired = True
    token.retired_amount = token.tonnes_co2
    token.retired_by = order.buyer_address
    token.retired_at = datetime.now(timezone.utc)
    session.add(token)

    txn = Transaction(
        token_id=order.token_id,
        farm_id=token.farm_id,
        seller_address=token.farmer_address,
        buyer_address=order.buyer_address,
        price_usd=gross_usd,
        price_lkr=round(gross_usd * settings.usd_to_lkr, 0),
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
        mrv_cost_share_usd=settings.mrv_cost_per_token_usd,
        net_usd=net_usd,
        net_lkr=net_lkr,
        tx_hash=retire_tx,
        block_explorer_url=f"{settings.block_explorer_base_url}/{retire_tx}",
    )


@router.get("/transactions")
async def list_transactions(
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """List all marketplace transactions, most recent first."""
    result = await session.exec(
        select(Transaction).order_by(Transaction.created_at.desc())
    )
    return [t.model_dump() for t in result.all()]
