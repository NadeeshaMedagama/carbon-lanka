from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime
import hashlib

from app.db.database import get_session
from app.models.credit import CreditToken, PoolBundle
from app.models.farm import Farm
from app.core.pooling import get_pool_bundle
from app.config import settings

router = APIRouter(prefix="/credits", tags=["Credits"])


@router.get("/pool", response_model=PoolBundle)
async def pool_status(session: AsyncSession = Depends(get_session)) -> PoolBundle:
    """Get current aggregation pool status with pro-rata payout breakdown."""
    return await get_pool_bundle(session)


@router.post("/mint")
async def mint_credit(
    farm_id: int,
    farmer_address: str = "0x0000000000000000000000000000000000000000",
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Mint a CarbonCredit ERC-1155 token for a farm.

    In production this calls the deployed Solidity contract via web3.py.
    For the MVP it returns a simulated transaction hash and token ID.
    """
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if not farm.estimated_tonnes_co2:
        raise HTTPException(status_code=422, detail="Farm has no MRV estimate")

    # Generate deterministic demo token ID and tx hash
    token_seed = f"{farm_id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:2026"
    token_id = int(hashlib.sha256(token_seed.encode()).hexdigest()[:8], 16) % 100000
    tx_hash = "0x" + hashlib.sha256((token_seed + "tx").encode()).hexdigest()
    sat_hash = "0x" + hashlib.sha256((token_seed + "sat").encode()).hexdigest()

    token = CreditToken(
        token_id=token_id,
        farm_id=farm_id,
        farmer_address=farmer_address,
        tonnes_co2=farm.estimated_tonnes_co2,
        vintage=str(datetime.utcnow().year),
        methodology="Verra VMD0042",
        sat_hash=sat_hash,
        tx_hash=tx_hash,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)

    return {
        "token_id": token_id,
        "farm_id": farm_id,
        "tonnes_co2": farm.estimated_tonnes_co2,
        "tx_hash": tx_hash,
        "block_explorer_url": f"{settings.polygon_block_explorer_url}/{tx_hash}",
        "network": "Polygon Mumbai Testnet",
        "standard": "ERC-1155",
        "methodology": "Verra VMD0042",
        "vintage": "2026",
        "status": "minted",
    }


@router.get("")
async def list_credits(
    session: AsyncSession = Depends(get_session),
    retired: bool = False,
) -> list[dict]:
    """List all minted credit tokens."""
    query = select(CreditToken).where(CreditToken.retired == retired)
    result = await session.exec(query)
    tokens = result.all()
    return [t.model_dump() for t in tokens]
