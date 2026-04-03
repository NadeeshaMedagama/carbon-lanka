# CarbonMicro

**Carbon Credit Micro-Marketplace for Sri Lankan SMEs**

> AI Measurement · Blockchain Tokenisation · Satellite Verification

Built for **CryptX 2.0 Hackathon** — Responsible AI & Future of Work Domain
April 4, 2026 · University of Sri Jayewardenepura

---

## The Problem

Sri Lanka's 2M+ smallholder farmers generate real, measurable carbon value — but are locked out of global carbon markets by:

| Barrier | Detail |
|---------|--------|
| Minimum project size | Verra/Gold Standard require 10,000–50,000 t CO₂/yr. A tea farm generates 20–500 t |
| Verification cost | MRV audits cost $15,000–$80,000. A 200-tonne farm earns $2,400 |
| Technical complexity | 12–24 month registry process requiring lawyers & consultants |
| No local infrastructure | Zero Sri Lanka-specific registry, MRV provider, or aggregation platform |

---

## The Solution

Three components working together:

1. **AI-MRV Engine** — IPCC Tier-2 emission factor calculations estimate farm-level carbon sequestration at ±8% accuracy, without expensive auditors
2. **Credit Pooling** — Hundreds of small farms aggregate into Verra-compliant bundles (8,500+ tonnes), sharing the $200/farm verification cost
3. **Blockchain Marketplace** — ERC-1155 tokens on Polygon PoS. Credits sold to international buyers, payment flows automatically to farmers' mobile wallets in LKR

**Demo flow:** `Farm form → CO₂ estimate → Satellite verify → Pool → Blockchain mint → Marketplace sale → LKR payout`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Maps | Leaflet.js + Google Earth Engine tile overlay |
| Backend | FastAPI (Python 3.12) + Pydantic v2 + SQLModel |
| AI/MRV | scikit-learn + NumPy + IPCC Tier-2 emission factor DB |
| Satellite | Google Earth Engine Python API (Sentinel-2 NDVI) |
| Blockchain | Solidity 0.8.x + Hardhat + Polygon Mumbai testnet |
| Token Standard | ERC-1155 (multi-token, EIP-1155) |
| Payments | ethers.js + MetaMask |

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- MetaMask browser extension
- (Optional) Google Earth Engine account

### 1. Clone & configure

```bash
git clone https://github.com/team-ipv404/carbon-lanka.git
cd carbon-lanka
cp .env.example .env
# Edit .env with your keys
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Seed demo data (200 farms)
python -m app.db.seed

# Start API server
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 3. Smart Contracts

```bash
cd contracts
npm install

# Run tests
npx hardhat test

# Deploy to Mumbai testnet (requires DEPLOYER_PRIVATE_KEY in .env)
npx hardhat run scripts/deploy.js --network mumbai

# Copy deployed address to .env → CARBON_CREDIT_CONTRACT_ADDRESS
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 5. Docker (all-in-one)

```bash
docker-compose up --build
```

---

## Demo Script (4 Minutes)

See [`docs/demo-script.md`](docs/demo-script.md) for the full CryptX 2.0 presentation script.

**Quick version:**
1. Open http://localhost:5173 → Farmer page
2. Enter: 5 acres, Tea, Organic conversion 2023 → **Calculate**
3. See: 182 tonnes CO₂ · $1,456–$2,730 · 92% confidence
4. Click **Verify with Satellite** → NDVI map overlay
5. Click **Issue Credits** → Live Polygon Mumbai transaction fires
6. Open Marketplace → Sri Lanka Organic Tea Credit → **Buy**
7. Farmer wallet receives $1,955 (net of 6% fee) → displayed in LKR

---

## API Reference

See [`docs/api.md`](docs/api.md) for full endpoint documentation.

Key endpoints:
- `POST /mrv/calculate` — Run IPCC Tier-2 carbon estimate
- `POST /mrv/verify-satellite` — Cross-check with Sentinel-2 NDVI
- `GET /credits/pool` — View aggregation pool status
- `GET /marketplace` — List available credits
- `POST /marketplace/buy` — Purchase credit tokens

---

## Project Structure

```
carbon-lanka/
├── backend/          # FastAPI + AI-MRV engine
├── contracts/        # Solidity ERC-1155 + Hardhat
├── frontend/         # React + Tailwind marketplace UI
└── docs/             # Architecture, API, demo script
```

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

- Clark et al. (2024). ML for automated MRV — *Nature Food* doi:[10.1038/s43016-024-00965-0](https://doi.org/10.1038/s43016-024-00965-0)
- IPCC (2019). Guidelines Vol.4: Agriculture — [ipcc-nggip.iges.or.jp](https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol4.html)
- EU CBAM Regulation 2023/956 — [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956)
- Verra VMD0042 — [verra.org/methodology/vmd0042](https://verra.org/methodology/vmd0042/)
- Toucan Protocol Whitepaper — [docs.toucan.earth](https://docs.toucan.earth/toucan/introduction/whitepaper)
- EIP-1155 Multi Token Standard — [eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-1155)

---

*CryptX 2.0 Hackathon Finals · April 4, 2026 · University of Sri Jayewardenepura*
