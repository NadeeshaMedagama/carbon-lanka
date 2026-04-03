import hashlib
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime, timezone
import hashlib

from app.config import settings
from app.core.blockchain import get_blockchain_service
from app.core.pooling import get_pool_bundle
from app.db.database import get_session
from app.models.credit import CreditToken, PoolBundle
from app.models.farm import Farm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credits", tags=["Credits"])

_ETH_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_EXPLORER = settings.block_explorer_base_url


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

    When USE_REAL_BLOCKCHAIN=true, calls the deployed Solidity contract
    via web3.py (server-side, verifier pays gas).
    When false, returns a simulated transaction hash and token ID.
    """
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if not farm.estimated_tonnes_co2:
        raise HTTPException(status_code=422, detail="Farm has no MRV estimate")

    tonnes_int = int(round(farm.estimated_tonnes_co2))
    if tonnes_int < 1:
        raise HTTPException(status_code=422, detail="Estimated CO2 is below 1 tonne")

    vintage = str(datetime.utcnow().year)
    methodology = getattr(farm, "methodology", None) or "Verra VMD0042"

    sat_seed = f"{farm_id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:sat"
    sat_hash_hex = "0x" + hashlib.sha256(sat_seed.encode()).hexdigest()

    blockchain = get_blockchain_service()

    if blockchain is not None and settings.use_real_blockchain:
        if not _ETH_ADDRESS_RE.match(farmer_address):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid Ethereum address: {farmer_address}",
            )

        sat_hash_bytes = bytes.fromhex(sat_hash_hex[2:])

        try:
            result = await blockchain.mint(
                farmer_address=farmer_address,
                tonnes=tonnes_int,
                farm_id=f"FARM-{farm_id}",
                vintage=vintage,
                sat_hash_bytes=sat_hash_bytes,
            )
        except Exception as exc:
            logger.error("On-chain mint failed for farm %d: %s", farm_id, exc)
            raise HTTPException(
                status_code=502,
                detail=f"Blockchain mint failed: {exc}",
            )

        token_id = result["token_id"]
        tx_hash = result["tx_hash"]
        on_chain = True

    else:
        token_seed = f"{farm_id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:2026"
        token_id = int(hashlib.sha256(token_seed.encode()).hexdigest()[:8], 16) % 100000
        tx_hash = "0x" + hashlib.sha256((token_seed + "tx").encode()).hexdigest()
        on_chain = False

    token = CreditToken(
        token_id=token_id,
        farm_id=farm_id,
        farmer_address=farmer_address,
        tonnes_co2=farm.estimated_tonnes_co2,
        vintage=str(datetime.now(timezone.utc).year),
        methodology="Verra VMD0042",
        sat_hash=sat_hash,
        tx_hash=tx_hash,
        on_chain=on_chain,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)

    return {
        "token_id": token_id,
        "farm_id": farm_id,
        "tonnes_co2": farm.estimated_tonnes_co2,
        "tx_hash": tx_hash,
        "block_explorer_url": f"{_EXPLORER}/tx/{tx_hash}",
        "network": "Polygon Amoy Testnet" if on_chain else "Simulated",
        "standard": "ERC-1155",
        "methodology": methodology,
        "vintage": vintage,
        "status": "minted",
        "on_chain": on_chain,
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


@router.get("/{token_id}/on-chain")
async def get_credit_on_chain(token_id: int) -> dict:
    """
    Read credit metadata directly from the deployed smart contract.

    Returns the on-chain state independent of the backend database,
    allowing independent verification that the UI matches reality.
    """
    blockchain = get_blockchain_service()
    if blockchain is None or not settings.use_real_blockchain:
        raise HTTPException(
            status_code=503,
            detail="Blockchain integration is not enabled (USE_REAL_BLOCKCHAIN=false)",
        )

    try:
        credit = await blockchain.get_credit(token_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Could not read token #{token_id} from chain: {exc}",
        )

    return {
        "token_id": token_id,
        "farmer": credit["farmer"],
        "tonnes": credit["tonnes"],
        "farm_id": credit["farm_id"],
        "vintage": credit["vintage"],
        "methodology": credit["methodology"],
        "sat_hash": credit["sat_hash"],
        "retired": credit["retired"],
        "retired_by": credit["retired_by"],
        "retired_at": credit["retired_at"],
        "source": "on-chain (Polygon Amoy)",
    }


@router.get("/blockchain/health")
async def blockchain_health() -> dict:
    """Check blockchain connectivity and verifier wallet status."""
    blockchain = get_blockchain_service()
    if blockchain is None:
        return {
            "enabled": False,
            "reason": "USE_REAL_BLOCKCHAIN is false or service not initialised",
        }
    info = await blockchain.check_connection()
    return {"enabled": True, **info}
