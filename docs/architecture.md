# CarbonMicro — System Architecture

## Overview

CarbonMicro operates across four layers, each handling a distinct concern:

```
LAYER 1: DATA SOURCES
  Farmer input (WhatsApp / Web form)
  Sentinel-2 Satellite (Google Earth Engine API)
  IoT Sensors (optional: soil probes, energy meters)
          ↓
LAYER 2: AI MEASUREMENT & VERIFICATION
  AI-MRV Engine         Verification Agent      Carbon Ledger
  IPCC Tier-2 factors   Satellite cross-check   Per-farm tonne record
  ±8% uncertainty        Flags >10% anomalies    Immutable audit trail
          ↓
LAYER 3: AGGREGATION & TOKENISATION
  Pooling Engine         Registry Filing         Token Minting
  Bundles small farms    Auto-generates PDD      ERC-1155 on Polygon
  Verra VMD0042          Verra/Gold Standard     Farm metadata on-chain
          ↓
LAYER 4: MARKETPLACE & SETTLEMENT
  Marketplace            Payment Rails           ESG Dashboard
  Credit listings        Stripe (USD/EUR)        Buyer offset reports
  Real-time pricing      CoinDCX (LKR)          CBAM certificate PDF
  Buyer discovery        Mobile wallet payout    Retirement on-chain
```

---

## Component Details

### AI-MRV Engine (`backend/app/core/mrv_engine.py`)

Implements IPCC Tier-2 methodology:

```
C_net = C_sequestered - C_emitted ± σ_uncertainty
where σ ≈ ±8% (IPCC 2019, Chapter 2.3)
```

- **Input:** Land area (ha), crop type, practice change, fertiliser kg/ha, fuel litres
- **Lookup:** `ipcc_emission_factors.json` — calibrated for Sri Lankan tropical conditions
- **Output:** Net tonnes CO₂, value range USD/LKR, confidence score, methodology citation

### Satellite Verification (`backend/app/core/satellite.py`)

- Uses Sentinel-2 NDVI via Google Earth Engine Python API
- Pre-computed NDVI scores per crop type for MVP demo
- Cross-checks self-reported sequestration against biomass index
- Anomaly threshold: >10% discrepancy triggers manual review flag
- Generates keccak256 `satHash` stored on-chain in the ERC-1155 token

### Credit Pooling (`backend/app/core/pooling.py`)

- Aggregates all farms with `in_pool=True` from the database
- Calculates pro-rata share per farm: `share = tonnes_farm / tonnes_total`
- Applies 6% platform fee + shared $40K MRV cost split equally
- Returns `PoolBundle` with per-farm payout breakdown in USD and LKR
- Flags whether pool meets Verra's 10,000-tonne minimum

### Smart Contract (`contracts/contracts/CarbonCredit.sol`)

ERC-1155 token with lifecycle enforcement:

| Function | Access | Description |
|----------|--------|-------------|
| `mint()` | VERIFIER_ROLE | Issue tokens after AI-MRV + Verra confirmation |
| `retire()` | Token holder | Permanently burn token as carbon offset |
| `getCredit()` | Public | Read credit metadata |
| `isRetired()` | Public | Check retirement status |

Key fraud-prevention property: `retired=true` is permanent and irreversible. The token is burned with `_burn()` making it impossible to double-count or re-sell.

---

## Data Flow: End-to-End Demo

```
1. Farmer fills form (land: 2.02 ha, crop: tea_organic, practice: organic_conversion)
   → POST /mrv/calculate
   → MRV Engine: C_net = 2.02ha × 8.5 t/ha × 1.35 bonus - 0.24 emissions = ~23.0 t CO₂

2. Satellite verification
   → POST /mrv/verify-satellite
   → GEE: NDVI = 0.74 (healthy biomass, consistent with estimate)
   → satHash = keccak256("tea_organic:0.74:6.9271:80.7718:2026-03")

3. Join pool
   → POST /farms + POST /farms/{id}/join-pool
   → Pool now has N farms, M total tonnes

4. Mint token
   → POST /credits/mint?farm_id={id}
   → CarbonCredit.sol: mint(farmer, 23, "FARM-NE-001", "2026", satHash)
   → Polygon Mumbai txn fires → visible on polygonscan.com

5. Marketplace listing
   → GET /marketplace → CreditCard shown in UI

6. Buyer purchases
   → POST /marketplace/buy → token retired on-chain → farmer wallet +$1,955

7. LKR payout
   → PayoutDisplay shows: gross $2,160 - 6% fee - $75 MRV = $1,955 net
   → At 310 LKR/USD = Rs 605,950
```

---

## Technology Choices

| Decision | Chosen | Why |
|----------|--------|-----|
| Blockchain | Polygon PoS | Carbon-neutral chain, $0.001/tx vs Ethereum $5–50 |
| Token standard | ERC-1155 | Multi-token, efficient batch operations, industry standard |
| AI framework | scikit-learn + IPCC data | Interpretable, auditable, no black-box model risk |
| Satellite | GEE Sentinel-2 | Free up to 500K ha/month, academic standard, globally trusted |
| Backend | FastAPI | Async, auto-generated docs, Pydantic type safety |
| DB (dev) | SQLite | Zero config for hackathon; swap to PostgreSQL for prod |
