"""Integration tests for FastAPI routes."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.database import init_db


@pytest.fixture(scope="module")
async def client():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.anyio
async def test_mrv_calculate(client: AsyncClient):
    payload = {
        "land_area_ha": 2.02,
        "crop_type": "tea_organic",
        "practice_change": "organic_conversion",
        "years_since_change": 3,
    }
    r = await client.post("/mrv/calculate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["tonnes_co2_net"] > 0
    assert data["confidence_score"] > 0
    assert "IPCC" in data["methodology"] or "VMD" in data["methodology"]


@pytest.mark.anyio
async def test_mrv_invalid_crop(client: AsyncClient):
    payload = {"land_area_ha": 1.0, "crop_type": "invalid_crop", "practice_change": "organic_conversion"}
    r = await client.post("/mrv/calculate", json=payload)
    assert r.status_code == 422


@pytest.mark.anyio
async def test_mrv_crop_types(client: AsyncClient):
    r = await client.get("/mrv/crop-types")
    assert r.status_code == 200
    types = r.json()
    keys = [t["key"] for t in types]
    assert "tea_organic" in keys
    assert "solar_cooperative" in keys


@pytest.mark.anyio
async def test_register_farm(client: AsyncClient):
    payload = {
        "land_area_ha": 1.5,
        "crop_type": "rubber_agroforestry",
        "practice_change": "agroforestry_adoption",
        "years_since_change": 2,
        "farmer_name": "Test Farmer",
        "district": "Kandy",
    }
    r = await client.post("/farms", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["id"] > 0
    assert data["estimated_tonnes_co2"] is not None


@pytest.mark.anyio
async def test_list_farms(client: AsyncClient):
    r = await client.get("/farms")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.anyio
async def test_pool_status(client: AsyncClient):
    r = await client.get("/credits/pool")
    assert r.status_code == 200
    data = r.json()
    assert "total_farms" in data
    assert "total_tonnes_co2" in data
    assert "meets_verra_minimum" in data


@pytest.mark.anyio
async def test_marketplace_listings(client: AsyncClient):
    r = await client.get("/marketplace")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
