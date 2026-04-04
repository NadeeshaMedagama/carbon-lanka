import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { CreditListing, CreditTokenRecord, FarmRecord, PoolBundle } from "../types";
import { formatTonnes, formatUSD } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";

const BARRIERS = [
  {
    title: "Minimum Project Size",
    problem: "Verra and Gold Standard require 1,000+ tCO₂ per project — a threshold most Sri Lankan smallholders can't hit alone.",
    impact: "Individual farms of 1–5 ha are locked out of the $2B voluntary carbon market.",
  },
  {
    title: "Verification Cost",
    problem: "Third-party audits cost $15,000–$50,000 per project cycle, paid upfront.",
    impact: "For a 2-ha tea farm earning $800/yr in credits, the economics don't work.",
  },
  {
    title: "Technical Complexity",
    problem: "Compliance requires GPS boundary surveys, MRV documentation, and annual reporting in English.",
    impact: "Without local-language digital tools, most farmers can't self-register.",
  },
  {
    title: "No Local Payout Rails",
    problem: "International carbon registries pay in USD via wire transfer with $25+ fees.",
    impact: "LKR mobile wallet integration is absent from every major carbon platform.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Submit farm data",
    desc: "Enter land area, crop type, and farming practice. Our IPCC Tier-2 + KGML-ag-Carbon AI ensemble returns a carbon estimate in under 10 seconds.",
    outcome: "Get a tCO₂ estimate with ±15% confidence interval",
  },
  {
    number: "02",
    title: "Satellite verification",
    desc: "Sentinel-2 NDVI imagery via Google Earth Engine cross-checks your land-use claim. Anomaly detection flags mismatches before any token is issued.",
    outcome: "Claim status: VERIFIED / SUSPICIOUS / REJECTED",
  },
  {
    number: "03",
    title: "Pool, tokenise, and receive payment",
    desc: "Your farm's credits pool with other smallholders to meet registry thresholds. ERC-1155 tokens mint on Polygon. Payout settles in LKR to your mobile wallet.",
    outcome: "Carbon income paid in LKR, no USD wire required",
  },
];

export default function Home() {
  const { user } = useAuth();
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [pool, setPool] = useState<PoolBundle | null>(null);
  const [listings, setListings] = useState<CreditListing[]>([]);
  const [retired, setRetired] = useState<CreditTokenRecord[]>([]);

  useEffect(() => {
    Promise.all([api.listFarms(), api.getPool(), api.getListings(), api.listCredits(true)])
      .then(([farmRows, poolRow, listingRows, retiredRows]) => {
        setFarms(farmRows);
        setPool(poolRow);
        setListings(listingRows);
        setRetired(retiredRows);
      })
      .catch(() => {
        setFarms([]);
        setPool(null);
        setListings([]);
        setRetired([]);
      });
  }, []);

  const stats = useMemo(() => {
    const pooledFarms = farms.filter((f) => f.in_pool).length;
    const listedTonnes = listings.reduce((sum, l) => sum + l.tonnes_co2, 0);
    return [
      { value: String(farms.length), label: "Registered farms" },
      { value: pool ? formatTonnes(pool.total_tonnes_co2) : "-", label: "Pooled CO₂" },
      { value: String(retired.length), label: "Retired credits" },
      { value: String(pooledFarms), label: "Farms in pool" },
      { value: formatTonnes(listedTonnes), label: "Listed volume" },
      { value: listings.length > 0 ? formatUSD(listings.reduce((s, l) => s + l.price_usd, 0)) : "-", label: "Live listing value" },
    ];
  }, [farms, listings, pool, retired.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-20">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="space-y-7">
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight">
            Sri Lankan farms.<br />
            Real carbon value.<br />
            <span className="text-carbon-400">Paid in LKR.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">
            IPCC Tier-2 measurement, Sentinel-2 satellite verification, and ERC-1155 blockchain
            tokenisation — for farms too small for Verra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/farmer"
            className="px-7 py-3.5 rounded-xl bg-carbon-600 hover:bg-carbon-500 text-white font-semibold text-base transition-colors"
          >
            Calculate My Farm's Carbon
          </Link>
          <Link
            to="/marketplace"
            className="text-carbon-400 hover:text-carbon-300 font-medium text-sm transition-colors"
          >
            Browse marketplace →
          </Link>
        </div>

        {/* Sign-in callout — only when not logged in */}
        {!user && (
          <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-forest-light px-4 py-2.5 text-sm text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-carbon-400 shrink-0" />
            <span>
              Sign in to save your estimates to your dashboard.{" "}
              <Link to="/auth" className="text-carbon-400 hover:text-carbon-300 font-medium">
                Sign in
              </Link>
            </span>
          </div>
        )}

        {/* Live stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-forest-light p-4 text-center"
            >
              <div className="text-xl font-bold text-carbon-400">{s.value}</div>
              <div className="text-gray-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem-first ───────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="space-y-2">
          <div className="text-carbon-400 text-sm font-semibold uppercase tracking-widest">
            The Access Problem
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            2M+ smallholder farmers.<br />
            <span className="text-gray-400">Zero carbon income.</span>
          </h2>
          <p className="text-gray-400 text-base max-w-2xl mt-3">
            Sri Lanka has over 2 million hectares of agricultural land and 22% forest cover.
            The carbon value generated is real — but four structural barriers stop smallholders
            from monetising it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {BARRIERS.map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-white/10 bg-forest-light p-5 space-y-2 text-left"
            >
              <div className="text-white font-semibold">{b.title}</div>
              <div className="text-gray-300 text-sm">{b.problem}</div>
              <div className="text-gray-500 text-xs">{b.impact}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="space-y-2">
          <div className="text-carbon-400 text-sm font-semibold uppercase tracking-widest">
            How It Works
          </div>
          <h2 className="text-3xl font-bold text-white">3 steps from farm data to LKR payout</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((item) => (
            <div key={item.number} className="space-y-3">
              <div className="text-4xl font-bold text-carbon-600/60 leading-none">
                {item.number}
              </div>
              <div className="text-white font-semibold text-lg">{item.title}</div>
              <div className="text-gray-400 text-sm leading-relaxed">{item.desc}</div>
              <div className="rounded-lg bg-carbon-900/30 border border-carbon-700/40 px-3 py-2 text-carbon-400 text-xs font-medium">
                {item.outcome}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CBAM warning ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-yellow-700/30 bg-yellow-900/10 p-6 space-y-2">
        <h3 className="text-yellow-300 font-bold text-lg">
          EU CBAM takes full effect in 2026
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed max-w-3xl">
          The EU Carbon Border Adjustment Mechanism requires verified carbon evidence for
          goods exported to the EU. Sri Lankan tea, rubber, and coconut exporters that cannot
          prove carbon credentials will face tariffs or lose EU buyer contracts.
          CarbonLanka provides the local measurement-to-market pipeline for that demand —
          starting at farm level, not corporate level.
        </p>
      </section>
    </div>
  );
}
