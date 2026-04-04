import hashlib
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

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

    if farm.claim_status in ("REJECTED", "SUSPICIOUS"):
        raise HTTPException(
            status_code=403,
            detail=f"Cannot mint credits for {farm.claim_status} farm. Manual review required.",
        )

    if not farm.admin_approved:
        raise HTTPException(
            status_code=403,
            detail="Farm must be approved by admin before credits can be minted. Please upload land proof documents and wait for admin verification.",
        )

    tonnes_int = int(round(farm.estimated_tonnes_co2))
    if tonnes_int < 1:
        raise HTTPException(status_code=422, detail="Estimated CO2 is below 1 tonne")

    vintage = str(datetime.utcnow().year)
    methodology = getattr(farm, "methodology", None) or "Verra VMD0042"

    sat_seed = f"{farm_id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:sat"
    sat_hash_hex = "0x" + hashlib.sha256(sat_seed.encode()).hexdigest()

    blockchain = get_blockchain_service()

    if blockchain is not None and settings.use_real_blockchain:
        # Zero address is rejected by the contract ("Invalid farmer address").
        # Fall back to the verifier's own wallet so the mint succeeds even when
        # the farmer hasn't connected a personal wallet yet.
        if farmer_address == "0x0000000000000000000000000000000000000000":
            farmer_address = blockchain.account.address
            logger.info(
                "No farmer address supplied — using verifier address %s for farm %d",
                farmer_address, farm_id,
            )

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
        sat_hash=sat_hash_hex,
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
        "block_explorer_url": f"{settings.block_explorer_base_url}/{tx_hash}",
        "network": "Polygon Mumbai Testnet",
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
async def get_credit_on_chain(
    token_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Read credit metadata from the deployed smart contract when blockchain is enabled,
    or from the database record when running in simulation mode.
    """
    # Always look up the DB record first — needed in both paths
    result = await session.exec(
        select(CreditToken).where(CreditToken.token_id == token_id)
    )
    token = result.first()
    if not token:
        raise HTTPException(status_code=404, detail=f"Token #{token_id} not found")

    blockchain = get_blockchain_service()

    # ── Real blockchain: only if this specific token was actually minted on-chain
    if token.on_chain and blockchain is not None and settings.use_real_blockchain:
        try:
            credit = await blockchain.get_credit(token_id)
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
        except Exception as exc:
            raise HTTPException(
                status_code=404,
                detail=f"Could not read token #{token_id} from chain: {exc}",
            )

    # ── Simulated token: serve from database ─────────────────────────────
    farm = await session.get(Farm, token.farm_id)
    return {
        "token_id": token.token_id,
        "farmer": token.farmer_address or "0x0000000000000000000000000000000000000000",
        "tonnes": int(token.tonnes_co2),
        "farm_id": f"FARM-{token.farm_id}",
        "vintage": token.vintage,
        "methodology": token.methodology,
        "sat_hash": token.sat_hash,
        "retired": token.retired,
        "retired_by": token.retired_by,
        "retired_at": int(token.retired_at.timestamp()) if token.retired_at else 0,
        "district": farm.district if farm else None,
        "crop_type": farm.crop_type if farm else None,
        "source": "simulated (not minted on-chain)",
    }


@router.get("/blockchain/health")
async def blockchain_health() -> dict:
    """Check blockchain connectivity and verifier wallet status."""
    blockchain = get_blockchain_service()
    contract_addr = settings.carbon_credit_contract_address or None
    if blockchain is None:
        return {
            "enabled": False,
            "connected": False,
            "contract_address": contract_addr,
            "reason": "Blockchain not initialised — set DEPLOYER_PRIVATE_KEY + CARBON_CREDIT_CONTRACT_ADDRESS",
        }
    info = await blockchain.check_connection()
    return {"enabled": True, "connected": info.get("connected", False), **info}
