"""
Admin routes — manual verification, anomaly review, and platform management.

Authentication: pass the admin secret key in the X-Admin-Key header.
Default key (configurable via ADMIN_SECRET_KEY env var): "carbonlanka-admin"
"""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Body
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.core.blockchain import get_blockchain_service
from app.db.database import get_session
from app.models.farm import Farm
from app.models.credit import CreditToken

log = logging.getLogger("carbonlanka.admin")

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Auth dependency ──────────────────────────────────────────────────────────

def _require_admin(x_admin_key: str = Header(default="")) -> None:
    if x_admin_key != settings.admin_secret_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Platform-wide statistics for the admin dashboard."""
    farms = list((await session.exec(select(Farm))).all())
    tokens = list((await session.exec(select(CreditToken))).all())

    status_counts: dict[str, int] = {"VERIFIED": 0, "UNVERIFIED": 0, "SUSPICIOUS": 0, "REJECTED": 0}
    for f in farms:
        status_counts[f.claim_status] = status_counts.get(f.claim_status, 0) + 1

    flagged = [f for f in farms if f.anomaly_flag or f.claim_status in ("SUSPICIOUS", "REJECTED")]

    return {
        "total_farms": len(farms),
        "total_credits": len(tokens),
        "flagged_count": len(flagged),
        "retired_credits": sum(1 for t in tokens if t.retired),
        "on_chain_credits": sum(1 for t in tokens if t.on_chain),
        "total_tonnes_co2": round(sum(f.estimated_tonnes_co2 or 0 for f in farms), 2),
        "pooled_farms": sum(1 for f in farms if f.in_pool),
        "claim_status_counts": status_counts,
    }


# ── Flagged submissions ───────────────────────────────────────────────────────

@router.get("/farms/flagged")
async def get_flagged_farms(
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Return all farms that have anomaly flags or SUSPICIOUS/REJECTED claim status."""
    farms = list((await session.exec(select(Farm))).all())
    flagged = [
        f for f in farms
        if f.anomaly_flag or f.claim_status in ("SUSPICIOUS", "REJECTED")
    ]
    # Most recent first
    flagged.sort(key=lambda f: f.created_at, reverse=True)
    return [f.model_dump() for f in flagged]


# ── All farms ────────────────────────────────────────────────────────────────

@router.get("/farms")
async def list_all_farms(
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Return all farms, most recent first."""
    farms = list((await session.exec(select(Farm))).all())
    farms.sort(key=lambda f: f.created_at, reverse=True)
    return [f.model_dump() for f in farms]


# ── Auto-mint helper ─────────────────────────────────────────────────────────

async def _auto_mint_credit(farm: Farm, session: AsyncSession) -> dict | None:
    """Mint a CreditToken for an approved farm (pool + blockchain).

    Returns a dict with token info on success, or None if the farm is not
    eligible (e.g. no CO2 estimate or < 1 tonne).
    """
    if not farm.estimated_tonnes_co2 or farm.estimated_tonnes_co2 < 1:
        log.info("Skip auto-mint for farm %d: estimated_tonnes_co2=%s", farm.id, farm.estimated_tonnes_co2)
        return None

    tonnes_int = int(round(farm.estimated_tonnes_co2))
    vintage = str(datetime.now(timezone.utc).year)
    methodology = "Verra VMD0042"

    sat_seed = f"{farm.id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:sat"
    sat_hash_hex = "0x" + hashlib.sha256(sat_seed.encode()).hexdigest()

    blockchain = get_blockchain_service()
    farmer_address = "0x0000000000000000000000000000000000000000"

    if blockchain is not None and settings.use_real_blockchain:
        # Use verifier address when no farmer wallet is known
        farmer_address = blockchain.account.address

        sat_hash_bytes = bytes.fromhex(sat_hash_hex[2:])
        result = await blockchain.mint(
            farmer_address=farmer_address,
            tonnes=tonnes_int,
            farm_id=f"FARM-{farm.id}",
            vintage=vintage,
            sat_hash_bytes=sat_hash_bytes,
        )
        token_id = result["token_id"]
        tx_hash = result["tx_hash"]
        on_chain = True
    else:
        token_seed = f"{farm.id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:2026"
        token_id = int(hashlib.sha256(token_seed.encode()).hexdigest()[:8], 16) % 100000
        tx_hash = "0x" + hashlib.sha256((token_seed + "tx").encode()).hexdigest()
        on_chain = False

    token = CreditToken(
        token_id=token_id,
        farm_id=farm.id,
        farmer_address=farmer_address,
        tonnes_co2=farm.estimated_tonnes_co2,
        vintage=vintage,
        methodology=methodology,
        sat_hash=sat_hash_hex,
        tx_hash=tx_hash,
        on_chain=on_chain,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)

    explorer_url = f"{settings.block_explorer_base_url}/{tx_hash}"
    log.info(
        "Auto-minted token %d for farm %d (%.2f t CO2, on_chain=%s)",
        token_id, farm.id, farm.estimated_tonnes_co2, on_chain,
    )
    return {
        "token_id": token_id,
        "tx_hash": tx_hash,
        "on_chain": on_chain,
        "block_explorer_url": explorer_url,
        "tonnes_co2": farm.estimated_tonnes_co2,
    }


# ── Approve farm ─────────────────────────────────────────────────────────────

@router.post("/farms/{farm_id}/approve")
async def approve_farm(
    farm_id: int,
    note: str = Body(default="Manually approved by admin", embed=True),
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark a farm as VERIFIED and clear its anomaly flag."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if not farm.land_proof_url:
        raise HTTPException(
            status_code=422,
            detail="Cannot approve farm without land ownership proof document. Farmer must upload proof first.",
        )

    old_status = farm.claim_status
    farm.claim_status = "VERIFIED"
    farm.anomaly_flag = False
    farm.admin_approved = True
    farm.in_pool = True
    farm.claim_status_reason = note
    session.add(farm)
    await session.commit()
    await session.refresh(farm)

    log.info("Admin approved farm %d (%s → VERIFIED, in_pool=True): %s", farm_id, old_status, note)

    # Auto-mint credit token so the farmer doesn't need to take further action
    mint_info = None
    mint_error = None
    try:
        mint_info = await _auto_mint_credit(farm, session)
    except Exception as exc:
        mint_error = str(exc)
        log.warning("Auto-mint failed for farm %d after approval: %s", farm_id, exc)

    resp: dict = {"success": True, "farm_id": farm_id, "claim_status": "VERIFIED", "admin_approved": True}
    if mint_info:
        resp["mint"] = mint_info
    if mint_error:
        resp["mint_error"] = mint_error
    return resp


# ── Reject farm ──────────────────────────────────────────────────────────────

@router.post("/farms/{farm_id}/reject")
async def reject_farm(
    farm_id: int,
    reason: str = Body(default="Manually rejected by admin", embed=True),
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Mark a farm as REJECTED (blocks it from minting / pool entry)."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    old_status = farm.claim_status
    farm.claim_status = "REJECTED"
    farm.anomaly_flag = True
    farm.admin_approved = False
    farm.claim_status_reason = reason
    session.add(farm)
    await session.commit()

    log.info("Admin rejected farm %d (%s → REJECTED): %s", farm_id, old_status, reason)
    return {"success": True, "farm_id": farm_id, "claim_status": "REJECTED"}


# ── Flag farm ────────────────────────────────────────────────────────────────

@router.post("/farms/{farm_id}/flag")
async def flag_farm(
    farm_id: int,
    reason: str = Body(default="Manually flagged for review by admin", embed=True),
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Raise an anomaly flag on a farm and move it to SUSPICIOUS status."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    farm.anomaly_flag = True
    if farm.claim_status in ("VERIFIED", "UNVERIFIED"):
        farm.claim_status = "SUSPICIOUS"
    farm.claim_status_reason = reason
    session.add(farm)
    await session.commit()

    log.info("Admin flagged farm %d as SUSPICIOUS: %s", farm_id, reason)
    return {"success": True, "farm_id": farm_id, "claim_status": farm.claim_status}


# ── Delete farm ───────────────────────────────────────────────────────────────

@router.delete("/farms/{farm_id}")
async def delete_farm(
    farm_id: int,
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Hard-delete a farm and all its associated credit tokens."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    tokens = list((await session.exec(
        select(CreditToken).where(CreditToken.farm_id == farm_id)
    )).all())
    for token in tokens:
        await session.delete(token)

    await session.delete(farm)
    await session.commit()

    log.info("Admin deleted farm %d + %d tokens", farm_id, len(tokens))
    return {"success": True, "deleted_farm_id": farm_id, "deleted_tokens": len(tokens)}


# ── All credits ───────────────────────────────────────────────────────────────

@router.get("/credits")
async def list_all_credits(
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Return all credit tokens with their associated farm metadata."""
    tokens = list((await session.exec(select(CreditToken))).all())
    tokens.sort(key=lambda t: t.minted_at, reverse=True)

    result = []
    for token in tokens:
        farm = await session.get(Farm, token.farm_id)
        d = token.model_dump()
        d["farmer_name"] = farm.farmer_name if farm else "Unknown"
        d["district"] = farm.district if farm else "Unknown"
        d["crop_type"] = farm.crop_type if farm else "Unknown"
        d["farm_claim_status"] = farm.claim_status if farm else "UNKNOWN"
        result.append(d)
    return result


# ── Force-retire credit ───────────────────────────────────────────────────────

@router.post("/credits/{token_id}/retire")
async def force_retire_credit(
    token_id: int,
    reason: str = Body(default="Administratively retired", embed=True),
    _: None = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Administratively retire a credit token (bypasses marketplace flow)."""
    result = await session.exec(
        select(CreditToken).where(CreditToken.token_id == token_id)
    )
    token = result.first()
    if not token:
        raise HTTPException(status_code=404, detail="Credit token not found")
    if token.retired:
        raise HTTPException(status_code=409, detail="Token is already retired")

    from datetime import datetime, timezone
    token.retired = True
    token.retired_by = f"admin:{reason}"
    token.retired_at = datetime.now(timezone.utc)
    session.add(token)
    await session.commit()

    log.info("Admin force-retired token %d: %s", token_id, reason)
    return {"success": True, "token_id": token_id, "retired": True}
