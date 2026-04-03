"""
Demo seed: generates 200 realistic farms + marketplace credit listings.

When USE_REAL_BLOCKCHAIN=true, the first few tokens are minted on-chain
via the BlockchainService (slow — ~3s per tx on Amoy).
Otherwise, tokens use simulated hashes for instant seeding.

Run with: python -m app.db.seed
"""

import asyncio
import hashlib
import logging
import random
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.db.database import init_db, AsyncSessionLocal
from app.models.farm import Farm, FarmInput
from app.models.credit import CreditToken
from app.core.mrv_engine import calculate_carbon

logger = logging.getLogger(__name__)
random.seed(42)

DISTRICTS = {
    "Nuwara Eliya": (-6.9271, 80.7718, 0.4),
    "Ratnapura":    (-6.6828, 80.3992, 0.3),
    "Gampaha":      (-7.0873, 80.0144, 0.2),
    "Kandy":        (-7.2906, 80.6337, 0.3),
    "Matale":       (-7.4675, 80.6234, 0.2),
    "Badulla":      (-6.9934, 81.0550, 0.3),
    "Kurunegala":   (-7.4867, 80.3647, 0.2),
    "Kegalle":      (-7.2513, 80.3464, 0.2),
}

CROP_TYPES = [
    ("tea_organic",         0.30),
    ("tea_conventional",    0.15),
    ("rubber_agroforestry", 0.15),
    ("paddy_rice",          0.12),
    ("spice_cinnamon",      0.10),
    ("coconut_organic",     0.10),
    ("forest_regen",        0.05),
    ("solar_cooperative",   0.03),
]

PRACTICE_CHANGES = {
    "tea_organic":          "organic_conversion",
    "tea_conventional":     "conventional_management",
    "rubber_agroforestry":  "agroforestry_adoption",
    "paddy_rice":           "improved_water_management",
    "spice_cinnamon":       "organic_conversion",
    "coconut_organic":      "organic_conversion",
    "forest_regen":         "forest_regen",
    "solar_cooperative":    "solar_install",
}

FARMER_NAMES = [
    "Priya Silva", "Sunil Perera", "Kumari Fernando", "Roshan Jayawardena",
    "Nirosha Wickramasinghe", "Chaminda Bandara", "Sanduni Rajapaksa",
    "Thilak Gunawardena", "Malini Dissanayake", "Asanka Karunarathna",
    "Dilrukshi Amarasinghe", "Sanjaya Madushanka", "Hiruni Senanayake",
    "Chathura Weerasinghe", "Ruwan Pathirana", "Kavindi Liyanage",
    "Buddhika Rathnayaka", "Oshadi Jayasuriya", "Prasad Gunasekara",
    "Isuru Samarasinghe",
]

MARKETPLACE_LISTINGS = 20
ON_CHAIN_LISTINGS = 5  # max tokens to mint on real blockchain during seed


def _weighted_choice(choices):
    items, weights = zip(*choices)
    return random.choices(items, weights=weights, k=1)[0]


def _rand_coord(base: float, spread: float) -> float:
    return round(base + random.uniform(-spread, spread), 6)


def _make_token_id(farm_id: int, crop: str, tonnes: float) -> int:
    seed = f"{farm_id}:{crop}:{tonnes:.2f}:2026"
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % 100_000


def _make_tx_hash(farm_id: int, suffix: str = "") -> str:
    seed = f"tx:{farm_id}:{suffix}:carbonlanka"
    return "0x" + hashlib.sha256(seed.encode()).hexdigest()


async def _mint_on_chain(farm: Farm, farmer_address: str) -> dict | None:
    """Attempt to mint a real token on-chain. Returns None on failure."""
    from app.core.blockchain import get_blockchain_service

    blockchain = get_blockchain_service()
    if blockchain is None:
        return None

    tonnes = int(round(farm.estimated_tonnes_co2 or 0))
    if tonnes < 1:
        return None

    sat_seed = f"{farm.id}:{farm.crop_type}:{farm.estimated_tonnes_co2}:sat"
    sat_hash_bytes = bytes.fromhex(
        hashlib.sha256(sat_seed.encode()).hexdigest()
    )

    try:
        result = await blockchain.mint(
            farmer_address=farmer_address,
            tonnes=tonnes,
            farm_id=f"FARM-{farm.id}",
            vintage="2026",
            sat_hash_bytes=sat_hash_bytes,
        )
        logger.info(
            "On-chain seed mint: token #%d (%d t) tx=%s",
            result["token_id"], tonnes, result["tx_hash"],
        )
        return result
    except Exception as exc:
        logger.warning("On-chain seed mint failed for farm %d: %s", farm.id, exc)
        return None


async def seed(session: AsyncSession):
    existing = await session.exec(select(Farm))
    if existing.first():
        print("Database already seeded. Skipping.")
        return

    # ── 1. Create 200 farms ───────────────────────────────────────────────
    farms = []
    for i in range(200):
        district = random.choice(list(DISTRICTS.keys()))
        lat_base, lng_base, spread = DISTRICTS[district]
        crop = _weighted_choice(CROP_TYPES)
        practice = PRACTICE_CHANGES[crop]
        land_area = round(random.uniform(0.5, 8.0), 2)
        years = random.randint(1, 5)
        fertiliser = round(random.uniform(0, 80), 1) if "conventional" in crop else 0.0
        fuel = round(random.uniform(10, 200), 1)
        solar_kw = round(random.uniform(5, 50), 1) if crop == "solar_cooperative" else None

        farm_input = FarmInput(
            land_area_ha=land_area,
            crop_type=crop,
            practice_change=practice,
            years_since_change=years,
            fertiliser_kg_ha_yr=fertiliser,
            fuel_litres_yr=fuel,
            solar_kw_installed=solar_kw,
        )
        mrv = calculate_carbon(farm_input)

        farm = Farm(
            farmer_name=random.choice(FARMER_NAMES) + f" #{i+1}",
            district=district,
            land_area_ha=land_area,
            crop_type=crop,
            practice_change=practice,
            years_since_change=years,
            fertiliser_kg_ha_yr=fertiliser,
            fuel_litres_yr=fuel,
            solar_kw_installed=solar_kw,
            latitude=_rand_coord(lat_base, spread),
            longitude=_rand_coord(lng_base, spread),
            estimated_tonnes_co2=mrv.tonnes_co2_net,
            in_pool=True,
            created_at=datetime(2026, random.randint(1, 3), random.randint(1, 28)),
        )
        farms.append(farm)

    session.add_all(farms)
    await session.flush()

    # ── 2. Determine blockchain availability ──────────────────────────────
    use_chain = settings.use_real_blockchain
    blockchain_svc = None

    if use_chain:
        if settings.deployer_private_key and settings.carbon_credit_contract_address:
            from app.core.blockchain import init_blockchain_service, get_blockchain_service

            if get_blockchain_service() is None:
                init_blockchain_service(
                    rpc_url=settings.polygon_amoy_rpc,
                    private_key=settings.deployer_private_key,
                    contract_address=settings.carbon_credit_contract_address,
                )
            blockchain_svc = get_blockchain_service()
            if blockchain_svc:
                info = await blockchain_svc.check_connection()
                if not info["connected"]:
                    print("Warning: blockchain RPC not reachable, falling back to simulation")
                    blockchain_svc = None
                else:
                    print(
                        f"Blockchain connected — minting up to {ON_CHAIN_LISTINGS} "
                        f"tokens on-chain (verifier: {info['verifier_address'][:10]}...)"
                    )
        else:
            print("Warning: USE_REAL_BLOCKCHAIN=true but missing key/address, using simulation")

    # ── 3. Mint credit tokens for the first N farms → marketplace listings ─
    tokens = []
    on_chain_count = 0

    for farm in farms[:MARKETPLACE_LISTINGS]:
        tonnes = farm.estimated_tonnes_co2 or 0.0
        if tonnes < 1:
            continue

        farmer_address = "0x" + hashlib.sha256(
            f"farmer:{farm.id}".encode()
        ).hexdigest()[:40]

        if blockchain_svc and on_chain_count < ON_CHAIN_LISTINGS:
            chain_result = await _mint_on_chain(farm, farmer_address)
            if chain_result:
                token = CreditToken(
                    token_id=chain_result["token_id"],
                    farm_id=farm.id,
                    farmer_address=farmer_address,
                    tonnes_co2=tonnes,
                    vintage="2026",
                    methodology="Verra VMD0042",
                    sat_hash=_make_tx_hash(farm.id, "sat"),
                    tx_hash=chain_result["tx_hash"],
                    on_chain=True,
                    minted_at=datetime(2026, 3, random.randint(1, 28)),
                )
                tokens.append(token)
                on_chain_count += 1
                continue

        token_id = _make_token_id(farm.id, farm.crop_type, tonnes)
        tx_hash = _make_tx_hash(farm.id, "mint")
        sat_hash = _make_tx_hash(farm.id, "sat")

        token = CreditToken(
            token_id=token_id,
            farm_id=farm.id,
            farmer_address=farmer_address,
            tonnes_co2=tonnes,
            vintage="2026",
            methodology="Verra VMD0042",
            sat_hash=sat_hash,
            tx_hash=tx_hash,
            retired=False,
            on_chain=False,
            minted_at=datetime(2026, 3, random.randint(1, 31)),
        )
        tokens.append(token)

    session.add_all(tokens)
    await session.commit()

    total_tonnes = sum(f.estimated_tonnes_co2 or 0 for f in farms)
    print(f"Seeded {len(farms)} farms     | Pool: {total_tonnes:.0f} t CO2")
    print(f"Minted {len(tokens)} tokens   | {on_chain_count} on-chain, {len(tokens) - on_chain_count} simulated")


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
