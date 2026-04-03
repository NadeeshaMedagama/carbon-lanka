# CarbonMicro — Implementation Roadmap

## Phase 0 — Hackathon MVP (0–48 Hours)

### Team Split

| Member | Role | Deliverables |
|--------|------|-------------|
| M1 | AI/ML Engineer | IPCC Tier-2 MRV engine, farm input form, CO₂ estimate with uncertainty, GEE NDVI demo |
| M2 | Blockchain Developer | ERC-1155 contract, Polygon Mumbai deploy, token mint from AI estimate, MetaMask integration |
| M3 | Frontend Developer | React marketplace UI, credit listing cards, Leaflet pool map, buyer purchase flow |
| M4 | Backend + Demo | FastAPI backend, payment simulation, demo script, presentation slides |

### 48-Hour Timeline

| Phase | Hours | What Gets Built |
|-------|-------|----------------|
| **Setup** | H0–H4 | Repo init, FastAPI + React scaffold, Hardhat project, Polygon Mumbai wallet, GEE API key, team interface sync |
| **AI-MRV** | H4–H14 | IPCC Tier-2 engine; farm data form (land area, crop, practice); CO₂ estimate with confidence interval; NDVI demo via GEE pre-computed export |
| **Blockchain** | H14–H24 | ERC-1155 contract deployed to Mumbai testnet; token minted from AI estimate; MetaMask wallet integration; Polygon block explorer showing live transactions |
| **Marketplace** | H24–H36 | React credit listing page; mock international buyer wallet; purchase transaction on testnet; LKR value display; farm pool map with Leaflet (200 demo farms) |
| **Polish** | H36–H48 | End-to-end flow working; presentation deck with impact numbers; live demo rehearsal; screen recording backup |

### MVP Deliverables Checklist

- [ ] Farm input form (land area, crop type, practice change)
- [ ] AI carbon estimate with uncertainty bounds (±8%)
- [ ] Satellite NDVI verification (Sentinel-2 pre-computed or live GEE)
- [ ] Credit aggregation pool display (200 farms, 8,500 t total)
- [ ] ERC-1155 contract live on Polygon Mumbai testnet
- [ ] Token mint from AI estimate (visible on block explorer)
- [ ] Marketplace credit listing page
- [ ] Buy flow with simulated buyer wallet
- [ ] LKR payout display after conversion
- [ ] End-to-end demo under 4 minutes

---

## Phase 1 — Foundation (Months 1–3)

**Goal:** Working product for 10–20 real farms. Legal + registry partnerships. First verified credit batch.

1. **Legal registration** — Incorporate as Private Limited Company (BOI preferred). SEC registration if token issuance required. Cost: LKR 200,000–400,000.
2. **Registry partnership** — Engage Verra (VMD0042 Improved Agricultural Land Management) and Gold Standard. Timeline: 2–3 months technical dialogue.
3. **Pilot cohort** — Partner with Sri Lanka Tea Board + Department of Agriculture. 200 farms from cooperative societies in Nuwara Eliya/Ratnapura/Gampaha. Target: 3,000–5,000 t CO₂ for Batch 1.
4. **AI-MRV calibration** — Ground-truth soil carbon samples from 20 pilot farms. Calibrate IPCC Tier-2 against lab measurements. Target: ±10% for Sri Lankan conditions.
5. **Smart contract audit** — ConsenSys Diligence or CertiK formal audit. Cost: $5,000–$15,000 USD. Non-negotiable before real-money transactions.

---

## Phase 2 — Pilot & Verification (Months 4–9)

| Step | Months | Activity |
|------|--------|----------|
| Deploy to 200 farms | M4–5 | App to pilot cohort, WhatsApp onboarding, data collection |
| Run AI-MRV | M5–6 | All 200 farms measured, satellite cross-check, outlier review |
| Submit to Verra | M6–7 | Collective MRV report, VMD0042 PDD filing, $80/farm shared |
| Verra Validation | M7–8 | 60-day review, third-party validator, respond to queries |
| First Batch Sale | M8–9 | Credit issuance, token minting live, farmer mobile payout |

**Key Milestone Month 9:** First real money flows from an international buyer to a Sri Lankan farmer's mobile wallet → unlocks Series A funding.

---

## Phase 3 — Scale (Months 10–18)

1. **Expand to 5 sectors** — Rubber agroforestry, spices (cinnamon/pepper), solar cooperatives, reforestation (REDD+). 2–3 weeks calibration per sector.
2. **Automate Verra filing pipeline** — Document-generation agent auto-populates VMD0042 PDD template from AI-MRV database. Reduces filing from 3 months → 2 weeks. **This is the technical moat.**
3. **EU buyer acquisition** — Target 10–15 EU companies with CBAM exposure in Sri Lankan supply chains. Turnkey CBAM compliance package: verified credits + automated ESG report. $200–$500/company/month.
4. **MMDE integration** — MOU with Ministry of Environment for national carbon inventory support. Legitimacy + contract revenue.
5. **South Asia expansion** — Bangladesh (jute/rice), Nepal (community forestry), India (small dairy cooperatives). IPCC Tier-2 model already calibrated for South Asian conditions.

---

## Revenue Targets

| Period | Revenue | Scale |
|--------|---------|-------|
| Year 1 | $147,000 | Sri Lanka pilot, 200 farms |
| Year 3 | $2.4M | Sri Lanka full rollout, 5 sectors |
| Year 5 | $18M | South Asia expansion |
| Global VCM 2030 | $50B market | Platform plays |

---

## Technology Milestones

| Milestone | Target |
|-----------|--------|
| MVP demo live | Hackathon D-Day (Apr 4, 2026) |
| Smart contract audit complete | Month 3 |
| First Verra-verified batch | Month 8 |
| Automated PDD filing pipeline | Month 12 |
| Mobile app (React Native) | Month 6 |
| WhatsApp bot for farmer onboarding | Month 4 |
| Federated learning for farm privacy | Month 9 |

---

## References

- Verra VMD0042: https://verra.org/methodology/vmd0042/
- Sri Lanka NDC 2021: https://unfccc.int/sites/default/files/NDC/2022-06/Sri%20Lanka%20NDC%202021.pdf
- MMDE Climate Change Secretariat: https://www.climatechange.lk
- UN-REDD Sri Lanka: https://www.unredd.net/regions-and-countries/asia/sri-lanka.html
- Sri Lanka Tea Board: https://www.tea.lk
- EU CBAM Regulation: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956
