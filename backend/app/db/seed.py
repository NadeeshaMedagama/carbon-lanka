"""
Demo seed: generates 200 realistic farms across Sri Lanka's key districts.
Run with: python -m app.db.seed
"""

import asyncio
import random
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.database import init_db, AsyncSessionLocal
from app.models.farm import Farm
from app.core.mrv_engine import calculate_carbon, FarmInput

random.seed(42)

# Districts and their approximate coordinate ranges
DISTRICTS = {
    "Nuwara Eliya": (-6.9271, 80.7718, 0.4),
    "Ratnapura": (-6.6828, 80.3992, 0.3),
    "Gampaha": (-7.0873, 80.0144, 0.2),
    "Kandy": (-7.2906, 80.6337, 0.3),
    "Matale": (-7.4675, 80.6234, 0.2),
    "Badulla": (-6.9934, 81.0550, 0.3),
    "Kurunegala": (-7.4867, 80.3647, 0.2),
    "Kegalle": (-7.2513, 80.3464, 0.2),
}

CROP_TYPES = [
    ("tea_organic", 0.30),
    ("tea_conventional", 0.15),
    ("rubber_agroforestry", 0.15),
    ("paddy_rice", 0.12),
    ("spice_cinnamon", 0.10),
    ("coconut_organic", 0.10),
    ("forest_regen", 0.05),
    ("solar_cooperative", 0.03),
]

PRACTICE_CHANGES = {
    "tea_organic": "organic_conversion",
    "tea_conventional": "conventional_management",
    "rubber_agroforestry": "agroforestry_adoption",
    "paddy_rice": "improved_water_management",
    "spice_cinnamon": "organic_conversion",
    "coconut_organic": "organic_conversion",
    "forest_regen": "forest_regen",
    "solar_cooperative": "solar_install",
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


def _weighted_choice(choices):
    items, weights = zip(*choices)
    return random.choices(items, weights=weights, k=1)[0]


def _rand_coord(base: float, spread: float) -> float:
    return round(base + random.uniform(-spread, spread), 6)


async def seed(session: AsyncSession):
    existing = await session.exec(select(Farm))
    if existing.first():
        print("Database already seeded. Skipping.")
        return

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
            in_pool=True,  # all demo farms are in the pool
            created_at=datetime(2026, random.randint(1, 3), random.randint(1, 28)),
        )
        farms.append(farm)

    session.add_all(farms)
    await session.commit()

    total_tonnes = sum(f.estimated_tonnes_co2 or 0 for f in farms)
    print(f"Seeded {len(farms)} farms | Total pool: {total_tonnes:.0f} t CO2")


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
