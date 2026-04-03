# CarbonLanka API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## MRV Endpoints

### `POST /mrv/calculate`
Run IPCC Tier-2 carbon estimation.

**Request body:**
```json
{
  "land_area_ha": 2.02,
  "crop_type": "tea_organic",
  "practice_change": "organic_conversion",
  "years_since_change": 3,
  "fertiliser_kg_ha_yr": 0,
  "fuel_litres_yr": 0,
  "farmer_name": "Priya Silva",
  "district": "Nuwara Eliya"
}
```

**Response:**
```json
{
  "crop_type": "tea_organic",
  "land_area_ha": 2.02,
  "tonnes_co2_net": 22.98,
  "tonnes_co2_min": 21.14,
  "tonnes_co2_max": 24.82,
  "uncertainty_pct": 8.0,
  "confidence_score": 88.5,
  "value_usd_min": 169.12,
  "value_usd_max": 372.3,
  "value_lkr_min": 52427.0,
  "value_lkr_max": 115413.0,
  "methodology": "IPCC Tier-2 + VMD0042 IALM",
  "satellite_verified": false,
  "anomaly_flag": false
}
```

### `POST /mrv/verify-satellite`
Same as `/mrv/calculate` but cross-checks against Sentinel-2 NDVI.

**Query params:** `latitude` (float), `longitude` (float)
**Returns:** Same as above with `satellite_verified: true` and `satellite_ndvi_score`.

### `GET /mrv/ndvi-tile`
Returns NDVI tile metadata for Leaflet map overlay.

**Query params:** `crop_type`, `latitude`, `longitude`

### `GET /mrv/crop-types`
Lists all supported crop types.

---

## Farm Endpoints

### `POST /farms`
Register a farm (runs MRV, persists result).

### `GET /farms`
List farms. Query: `?in_pool=true|false`

### `GET /farms/{farm_id}`
Get a single farm.

### `POST /farms/{farm_id}/join-pool`
Add farm to aggregation pool.

---

## Credit Endpoints

### `GET /credits/pool`
Get aggregation pool status with pro-rata payout breakdown.

**Response (excerpt):**
```json
{
  "total_farms": 200,
  "total_tonnes_co2": 8547.3,
  "gross_value_usd": 102567.6,
  "platform_fee_usd": 6154.06,
  "shared_mrv_cost_usd": 40000,
  "net_to_farmers_usd": 56413.54,
  "net_to_farmers_lkr": 17488197,
  "meets_verra_minimum": false,
  "pool_members": [...]
}
```

### `POST /credits/mint`
Mint an ERC-1155 token for a farm.

**Query params:** `farm_id` (int), `farmer_address` (str, optional)

**Response:**
```json
{
  "token_id": 12345,
  "farm_id": 1,
  "tonnes_co2": 22.98,
  "tx_hash": "0xabc...",
  "block_explorer_url": "https://mumbai.polygonscan.com/tx/0xabc...",
  "network": "Polygon Mumbai Testnet",
  "standard": "ERC-1155",
  "methodology": "Verra VMD0042"
}
```

---

## Marketplace Endpoints

### `GET /marketplace`
List available (non-retired) credits.

### `POST /marketplace/buy`
Purchase and retire a credit token.

**Request body:**
```json
{
  "token_id": 12345,
  "buyer_address": "0xBUYER_ADDRESS",
  "price_usd": 12.0
}
```

**Response:**
```json
{
  "token_id": 12345,
  "farmer_name": "Priya Silva",
  "tonnes_co2": 22.98,
  "gross_usd": 275.76,
  "platform_fee_usd": 16.55,
  "mrv_cost_share_usd": 75.0,
  "net_usd": 184.21,
  "net_lkr": 57105,
  "tx_hash": "0xretire...",
  "block_explorer_url": "https://mumbai.polygonscan.com/tx/0xretire..."
}
```

---

## Supported Crop Types

| Key | Label | Typical t CO₂/ha/yr |
|-----|-------|---------------------|
| `tea_organic` | Organic Tea | 8.5 |
| `tea_conventional` | Conventional Tea | 4.2 |
| `paddy_rice` | Paddy Rice | 0.3 (after methane) |
| `rubber_agroforestry` | Rubber Agroforestry | 12.3 |
| `spice_cinnamon` | Cinnamon / Spice | 7.8 |
| `solar_cooperative` | Solar Co-operative | varies by kW |
| `forest_regen` | Forest Regeneration | 18.5 |
| `coconut_organic` | Organic Coconut | 6.2 |
