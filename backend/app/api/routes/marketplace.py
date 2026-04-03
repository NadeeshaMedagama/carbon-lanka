import hashlib
import logging
from datetime import datetime

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

_PLATFORM_FEE_RATE = 0.06
_MRV_COST_SHARE_USD = 75.0
_EXPLORER = settings.block_explorer_base_url


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
        price_usd = round(
            token.tonnes_co2
            * (settings.carbon_price_min + settings.carbon_price_max)
            / 2,
            2,
        )
        listings.append(
            {
                "token_id": token.token_id,
                "farm_id": token.farm_id,
                "farmer_name": farm.farmer_name if farm else "Unknown",
                "district": farm.district if farm else "",
                "crop_type": farm.crop_type if farm else token.methodology,
                "tonnes_co2": token.tonnes_co2,
                "vintage": token.vintage,
                "methodology": token.methodology,
                "price_usd": price_usd,
                "price_per_tonne_usd": (
                    settings.carbon_price_min + settings.carbon_price_max
                )
                / 2,
                "price_lkr": round(price_usd * settings.usd_to_lkr, 0),
                "tx_hash": token.tx_hash,
                "block_explorer_url": f"{_EXPLORER}/tx/{token.tx_hash}",
                "on_chain": token.on_chain,
            }
        )

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

    # ── On-chain verification (if blockchain enabled and tx hash provided) ──
    blockchain = get_blockchain_service()
    use_chain = (
        blockchain is not None
        and settings.use_real_blockchain
        and order.retire_tx_hash
    )

    if use_chain:
        try:
            chain_data = await blockchain.verify_retirement(
                tx_hash=order.retire_tx_hash,
                expected_token_id=order.token_id,
            )
            logger.info(
                "On-chain retirement verified for token #%d: %s",
                order.token_id,
                chain_data,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"On-chain retirement verification failed: {exc}",
            )
        except Exception as exc:
            logger.error(
                "Blockchain verification error for token #%d: %s",
                order.token_id,
                exc,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Could not verify retirement on-chain: {exc}",
            )
        retire_tx = order.retire_tx_hash
    else:
        retire_seed = (
            f"retire:{order.token_id}:{order.buyer_address}:{datetime.utcnow()}"
        )
        retire_tx = "0x" + hashlib.sha256(retire_seed.encode()).hexdigest()

    # ── Payout calculation ──────────────────────────────────────────────────
    gross_usd = token.tonnes_co2 * order.price_usd
    platform_fee = round(gross_usd * _PLATFORM_FEE_RATE, 2)
    net_usd = round(gross_usd - platform_fee - _MRV_COST_SHARE_USD, 2)
    net_lkr = round(net_usd * settings.usd_to_lkr, 0)

    # ── Update token record ─────────────────────────────────────────────────
    token.retired = True
    token.retired_amount = token.tonnes_co2
    token.retired_by = order.buyer_address
    token.retire_tx_hash = retire_tx
    token.retired_at = datetime.utcnow()
    session.add(token)

    # ── Record transaction ──────────────────────────────────────────────────
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
        block_explorer_url=f"{_EXPLORER}/tx/{retire_tx}",
    )
