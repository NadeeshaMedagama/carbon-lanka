# CarbonLanka Demo Script (4 Minutes)

This script matches the flow shown in the app and README for the CryptX 2.0 demo.

## Setup Checklist (Before Presenting)

- Backend running at `http://localhost:8000`
- Frontend running at `http://localhost:5173`
- Demo DB seeded (`python -m app.db.seed`)
- Browser wallet available (MetaMask), optional for demo flow
- Keep these tabs ready:
  - `http://localhost:5173/farmer`
  - `http://localhost:5173/marketplace`
  - `http://localhost:8000/docs`

## 0:00-0:30 - Problem (Home)

1. Open home page.
2. Say:
   - "Smallholder farms in Sri Lanka generate measurable carbon value."
   - "But they are blocked by verification cost, project size, and registry complexity."
3. Transition:
   - "CarbonLanka solves this with AI measurement, pooled verification, and blockchain settlement."

## 0:30-1:45 - AI Measurement + Satellite Verification (Farmer)

1. Go to **Measure** (`/farmer`).
2. Click **Load demo: 5-acre tea farm**.
3. Click **Calculate Carbon Estimate**.
4. Point out on-screen outputs:
   - Net CO2 estimate
   - Uncertainty range (+/-8%)
   - USD and LKR value range
   - Confidence score and methodology
5. Click **Verify with Satellite**.
6. Explain:
   - NDVI map is shown for cross-check.
   - If reported values significantly exceed expected satellite range, anomaly flag appears.

## 1:45-2:40 - Pooling + Tokenization (Farmer)

1. Click **Add to Pool ->**.
2. Explain pooled economics:
   - Farms aggregate toward Verra minimum threshold.
   - Shared MRV cost lowers per-farm burden.
3. Click **Issue Credits on Blockchain**.
4. On success screen, highlight:
   - Token ID
   - Transaction hash
   - Explorer link

## 2:40-3:35 - Marketplace + Retirement + Payout (Marketplace)

1. Go to **Market** (`/marketplace`).
2. Open a listed credit card and click **Buy Credit**.
3. After purchase banner appears, explain:
   - Token is retired and cannot be reused.
   - Gross, fee, and net payout are shown.
   - Farmer payout is displayed in both USD and LKR.
4. Optionally open Polygonscan link to show transaction trace.

## 3:35-4:00 - Close

Use this closing statement:

> "CarbonLanka turns fragmented farm-level climate value into verifiable, tradable credits.
> Farmers get transparent payouts, buyers get trustworthy offsets, and Sri Lanka gets a practical path to CBAM-ready carbon infrastructure."

## Backup Plan (If Live Services Fail)

- Use seeded data in Marketplace to show listings and pool map first.
- Use API docs (`/docs`) to demonstrate endpoint-level flow.
- Use screenshot/video backup of mint + retirement transactions.

