# CarbonLanka

**Carbon Credit Micro-Marketplace for Sri Lankan SMEs**

> KGML-AI Ensemble MRV · Satellite Verification · Blockchain Tokenisation

Built for **CryptX 2.0 Hackathon** — Responsible AI & Future of Work Domain
April 4, 2026 · University of Sri Jayewardenepura

---

## The Problem

Sri Lanka's 2M+ smallholder farmers generate real, measurable carbon value — but are locked out of global carbon markets by:

| Barrier | Detail |
|---------|--------|
| Minimum project size | Verra/Gold Standard require 10,000-50,000 t CO2/yr. A tea farm generates 20-500 t |
| Verification cost | MRV audits cost $15,000-$80,000. A 200-tonne farm earns $2,400 |
| Technical complexity | 12-24 month registry process requiring lawyers & consultants |
| No local infrastructure | Zero Sri Lanka-specific registry, MRV provider, or aggregation platform |

---

## The Solution

A 5-step AI + satellite + blockchain pipeline:

1. **IPCC Tier-2 SOC Calculation** — Soil organic carbon stock-change (IPCC 2019 Eq. 2.25) with Sri Lanka-specific emission factors
2. **Google Earth Engine Satellite** — Live Sentinel-2 NDVI verification, ERA5 weather data, OpenLandMap soil properties
3. **KGML-ag-Carbon Model** — GRU-based knowledge-guided ML (Liu et al. 2024) for ensemble carbon estimation
4. **Fraud Detection** — NDVI cross-check against expected crop ranges; anomaly flagging with claim status (VERIFIED / SUSPICIOUS / REJECTED)
5. **Blockchain Mint & Marketplace** — ERC-1155 tokens on Polygon Amoy, credit pooling for Verra compliance, LKR payout to farmers

**Demo flow:** `Farm form -> KGML Ensemble Estimate -> Satellite Verify -> Pool -> Blockchain Mint -> Marketplace Sale -> LKR Payout`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Maps | Leaflet.js + Google Earth Engine NDVI tile overlay |
| Backend | FastAPI (Python 3.12+) + Pydantic v2 + SQLModel |
| AI/MRV | IPCC Tier-2 + KGML-ag-Carbon ensemble (PyTorch GRU + MC Dropout) |
| Satellite | Google Earth Engine API (Sentinel-2 NDVI, ERA5, OpenLandMap) |
| Blockchain | Solidity 0.8.26 + Hardhat + Polygon Amoy testnet (chain ID 80002) |
| Token Standard | ERC-1155 (multi-token, EIP-1155) |
| Wallet | ethers.js v6 + MetaMask |

---

## Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **MetaMask** browser extension (for blockchain features)
- **Google Earth Engine** service account (optional — system works with simulated data if unavailable)

---

## Environment Setup

The project uses a **single `.env` file in the project root**. All three services read from it:

| Service | How it reads root `.env` |
|---------|--------------------------|
| **Backend** | `pydantic-settings` loads `../.env` then `.env` (root-first, local override) |
| **Contracts** | `hardhat.config.js` loads `../.env` explicitly via `dotenv` |
| **Frontend** | Vite `envDir: ".."` in `vite.config.ts` reads from the root |

> You only need to edit the root `.env` — do **not** create separate `.env` files inside `backend/` or `frontend/`.

### 1. Create `.env`

```bash
git clone https://github.com/team-ipv404/carbon-lanka.git
cd carbon-lanka
cp .env.example .env   # or create manually
```

Fill in the values:

```env
# ── Backend ──────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./carbonlanka.db
CARBON_PRICE_MIN=8.0
CARBON_PRICE_MAX=15.0
USD_TO_LKR=310.0

# Google Earth Engine (optional — works with simulated data if left empty)
GEE_SERVICE_ACCOUNT_KEY=./your-gee-key.json
GEE_PROJECT_ID=your-gee-project

# ── Blockchain ───────────────────────────────────────────
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
CARBON_CREDIT_CONTRACT_ADDRESS=
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# ── Frontend ─────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8000
VITE_CONTRACT_ADDRESS=
VITE_CHAIN_ID=80002
```

### 2. Get Blockchain Credentials

You need a **MetaMask wallet** with test POL tokens to deploy and interact with the smart contract.

#### Step 2a — Install MetaMask

1. Install the [MetaMask](https://metamask.io/) browser extension
2. Create a new wallet (or use an existing one)
3. Add **Polygon Amoy Testnet** manually or let the app auto-prompt:
   - **Network Name:** Polygon Amoy Testnet
   - **RPC URL:** `https://rpc-amoy.polygon.technology`
   - **Chain ID:** `80002`
   - **Currency Symbol:** POL
   - **Explorer:** `https://amoy.polygonscan.com`

#### Step 2b — Get Test POL Tokens (free)

1. Go to the [Polygon Amoy Faucet](https://faucet.polygon.technology/)
2. Paste your MetaMask wallet address
3. Request test POL — needed to pay gas fees for deploying and minting

#### Step 2c — Export Private Key

1. In MetaMask, click your account icon → **Account Details** → **Show Private Key**
2. Copy the key (starts with `0x...`)
3. Paste it into `.env` as `DEPLOYER_PRIVATE_KEY`

> **Never commit your private key to git.** The `.gitignore` already excludes `.env`.

#### Step 2d — Get Polygonscan API Key (optional)

1. Register at [polygonscan.com](https://polygonscan.com/register)
2. Go to **API Keys** → **Create New Key**
3. Paste into `.env` as `POLYGONSCAN_API_KEY`

This is only needed if you want to verify the contract source code on Polygonscan.

---

## Quick Start

### 1. Smart Contracts (deploy first)

```bash
cd contracts
npm install

# Compile the ERC-1155 contract
npx hardhat compile

# Run tests (14 tests)
npx hardhat test

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy
```

The deploy script will print a contract address like `0x7F3a...`. Copy it into `.env`:

```env
CARBON_CREDIT_CONTRACT_ADDRESS=0x7F3a...
VITE_CONTRACT_ADDRESS=0x7F3a...
```

> Both values should be the **same address**. The backend reads `CARBON_CREDIT_CONTRACT_ADDRESS`, the frontend reads `VITE_CONTRACT_ADDRESS`.

### 2. Backend

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Linux/macOS:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed demo data
python -m app.db.seed

# Start API server
uvicorn app.main:app --reload
```

The backend will be available at:
- **API:** http://localhost:8000
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at: **http://localhost:5173**

### 4. Connect Wallet

1. Open http://localhost:5173 in your browser
2. Click **Connect Wallet** in the app header
3. MetaMask will prompt to switch to Polygon Amoy — approve it
4. You're ready to mint and trade carbon credits

### 5. Docker (All-in-One)

```bash
docker-compose up --build
```

This starts both backend (port 8000) and frontend (port 5173).

---

## Running Tests

### Backend Tests (30 tests)

```bash
cd backend
python -m pytest tests/ -q
```

### Smart Contract Tests (14 tests)

```bash
cd contracts
npx hardhat test
```

### Frontend Type Check & Build

```bash
cd frontend
npx tsc --noEmit      # Type check
npm run build          # Production build
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/mrv/calculate` | IPCC Tier-2 carbon estimate |
| `POST` | `/mrv/calculate-kgml` | Full 5-step KGML ensemble pipeline |
| `POST` | `/mrv/verify-satellite` | Satellite-only NDVI verification |
| `GET`  | `/mrv/ndvi-tile` | NDVI tile data for map overlay |
| `GET`  | `/mrv/crop-types` | Available crop types |
| `GET`  | `/mrv/kgml-status` | KGML model + GEE health check |
| `POST` | `/farms` | Register a new farm |
| `GET`  | `/farms` | List all farms |
| `GET`  | `/farms/{id}` | Get farm details |
| `POST` | `/farms/{id}/join-pool` | Join credit aggregation pool |
| `GET`  | `/credits/pool` | View pool status & member payouts |
| `POST` | `/credits/mint` | Mint ERC-1155 carbon credit token |
| `GET`  | `/credits` | List minted credits |
| `GET`  | `/credits/{id}/on-chain` | Read credit data from smart contract |
| `GET`  | `/credits/blockchain/health` | Blockchain connectivity status |
| `GET`  | `/marketplace` | List credits for sale |
| `POST` | `/marketplace/buy` | Purchase a carbon credit |

Full interactive docs at http://localhost:8000/docs after starting the backend.

---

## Project Structure

```
carbon-lanka/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # FastAPI route handlers (mrv, farms, credits, marketplace)
│   │   ├── core/              # Business logic
│   │   │   ├── mrv_engine.py  # IPCC Tier-2 SOC calculation engine
│   │   │   ├── kgml_model.py  # KGML-ag-Carbon GRU model + MC Dropout
│   │   │   ├── gee_client.py  # Google Earth Engine integration
│   │   │   ├── satellite.py   # NDVI verification + fraud detection
│   │   │   └── blockchain.py  # Web3 contract interaction
│   │   ├── db/                # Database models + seed script
│   │   └── config.py          # Environment settings
│   ├── tests/                 # pytest test suite (30 tests)
│   └── requirements.txt
├── contracts/
│   ├── contracts/
│   │   └── CarbonCredit.sol   # ERC-1155 carbon credit smart contract
│   ├── test/                  # Hardhat tests (14 tests)
│   ├── scripts/               # Deploy, mint-demo, export-abi scripts
│   └── hardhat.config.js
├── frontend/
│   ├── src/
│   │   ├── components/        # FarmForm, CarbonEstimate, CreditCard
│   │   ├── pages/             # Home, FarmerPage, Dashboard, Marketplace
│   │   ├── hooks/             # useWeb3, useMRV custom hooks
│   │   ├── services/          # API client, blockchain service
│   │   └── types/             # TypeScript interfaces
│   └── package.json
├── docs/                      # Architecture docs, demo script
├── docker-compose.yml
└── .env                       # Environment configuration
```

---

## Demo Script (4 Minutes)

1. Open http://localhost:5173 -> **Farmer** page
2. Enter: 5 ha, Tea Organic, Nuwara Eliya (6.9271, 80.7718), 2 years since change
3. Click **Calculate** -> See KGML ensemble result with claim status badge
4. View the 5-step pipeline visualization: IPCC -> GEE -> KGML -> Satellite -> Ensemble
5. Register farm -> Join pool -> See Verra compliance meter
6. Connect MetaMask -> **Mint Credit** -> Live Polygon Amoy transaction
7. Open **Marketplace** -> Verify on-chain -> **Buy Credit**
8. Farmer receives LKR payout (net of 6% platform fee)
9. Check **Dashboard** -> MRV Pipeline Health (KGML model, GEE, blockchain status)

---

## Blockchain Setup (MetaMask)

To interact with the blockchain features:

1. Install [MetaMask](https://metamask.io/) browser extension
2. The app will auto-prompt to add **Polygon Amoy Testnet** (chain ID 80002)
3. Get test POL tokens from the [Polygon Amoy Faucet](https://faucet.polygon.technology/)
4. Connect your wallet in the app header

Network details (auto-added by the app):
- **Network:** Polygon Amoy Testnet
- **Chain ID:** 80002
- **RPC:** https://rpc-amoy.polygon.technology
- **Explorer:** https://amoy.polygonscan.com
- **Currency:** POL

---

## Revenue Model

| Stream | Rate | Year 1 |
|--------|------|--------|
| Transaction fee | 6% per credit sale | $45,000 |
| MRV SaaS | Rs 15K/project/yr | $8,000 |
| ESG/CBAM API | $200/company/month | $24,000 |
| Data licensing | $10K/dataset | $20,000 |
| MMDE contract | National carbon inventory | $50,000 |
| **Total** | | **$147,000** |

---

## References

- Liu et al. (2024). KGML-ag: Knowledge-Guided ML for Agricultural Carbon — *Nature Food*
- Clark et al. (2024). ML for automated MRV — *Nature Food* doi:[10.1038/s43016-024-00965-0](https://doi.org/10.1038/s43016-024-00965-0)
- IPCC (2019). Guidelines Vol.4: Agriculture — [ipcc-nggip.iges.or.jp](https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol4.html)
- EU CBAM Regulation 2023/956 — [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956)
- Verra VMD0042 — [verra.org/methodology/vmd0042](https://verra.org/methodology/vmd0042/)
- EIP-1155 Multi Token Standard — [eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-1155)

---

*CryptX 2.0 Hackathon Finals · April 4, 2026 · University of Sri Jayewardenepura*
