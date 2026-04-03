import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { CreditListing, CreditTokenRecord, FarmRecord, PoolBundle } from "../types";
import { formatTonnes, formatUSD } from "../utils/formatters";

const BARRIERS = [
  {
    title: "Minimum Project Size",
    problem: "Global registry thresholds are high for individual smallholders.",
    impact: "Many farms are too small to register as standalone projects.",
  },
  {
    title: "Verification Cost",
    problem: "Traditional verification is costly for individual producers.",
    impact: "High fixed costs can exceed the value of small projects.",
  },
  {
    title: "Technical Complexity",
    problem: "Compliance workflows are document-heavy and technical.",
    impact: "Small teams need simplified digital workflows to participate.",
  },
  {
    title: "No Local Infrastructure",
    problem: "SME-focused local digital infrastructure is still emerging.",
    impact: "Projects need local onboarding, language, and payout support.",
  },
];

export default function Home() {
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
    const listedValue = listings.reduce((sum, l) => sum + l.price_usd, 0);
    return [
      { value: String(farms.length), label: "Registered farms" },
      { value: String(pooledFarms), label: "Farms in pool" },
      { value: pool ? formatTonnes(pool.total_tonnes_co2) : "-", label: "Pooled CO2 volume" },
      { value: formatTonnes(listedTonnes), label: "Listed CO2 volume" },
      { value: formatUSD(listedValue), label: "Live listing value" },
      { value: String(retired.length), label: "Retired credits" },
    ];
  }, [farms, listings, pool, retired.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-6">
        <div className="inline-block px-3 py-1 rounded-full border border-carbon-700/60 bg-carbon-900/20 text-carbon-300 text-xs font-medium">
          CryptX 2.0 · Responsible AI &amp; Future of Work
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight">
          Carbon<span className="text-carbon-400">Micro</span>
        </h1>
        <p className="text-gray-300 text-lg max-w-3xl mx-auto">
          Carbon Credit Micro-Marketplace for Sri Lankan SMEs.<br />
          AI Measurement · Blockchain Tokenisation · Satellite Verification
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/farmer"
            className="px-6 py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 text-white font-semibold transition-colors"
          >
            Estimate Your Carbon
          </Link>
          <Link
            to="/marketplace"
            className="px-6 py-3 rounded-xl border border-white/15 hover:bg-white/5 text-white font-semibold transition-colors"
          >
            Browse Marketplace
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-xl border border-carbon-700/40 bg-carbon-900/20 hover:bg-carbon-900/40 text-carbon-300 font-semibold transition-colors"
          >
            Open ESG Dashboard
          </Link>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-forest-light p-4 text-center">
            <div className="text-xl font-bold text-carbon-400">{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-white">How It Works in 3 Steps</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Measure",
              desc: "Farmer submits basic data. AI-MRV computes tonnes and value range using IPCC Tier-2 factors.",
            },
            {
              step: "2",
              title: "Verify + Pool",
              desc: "Sentinel-2 NDVI cross-check validates claims. Small farms aggregate into a Verra-sized pool.",
            },
            {
              step: "3",
              title: "Tokenise + Sell",
              desc: "Credits mint as ERC-1155 on Polygon. Buyers retire credits and farmer payout is settled in LKR.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-forest-light p-5 space-y-2">
              <div className="w-7 h-7 rounded-full bg-carbon-800 text-carbon-300 text-sm font-bold flex items-center justify-center">
                {item.step}
              </div>
              <div className="text-white font-semibold">{item.title}</div>
              <div className="text-sm text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">The Problem</h2>
          <p className="text-gray-400 mt-2">
            Sri Lanka has 2M hectares of agricultural land, 22% forest cover, and a
            rapidly growing renewable sector. The carbon value generated is real — but
              still difficult to monetize. CarbonMicro focuses on removing four structural barriers.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {BARRIERS.map((b) => (
            <div key={b.title} className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
              <div className="text-carbon-400 font-semibold text-sm">{b.title}</div>
              <div className="text-white text-sm">{b.problem}</div>
              <div className="text-gray-400 text-xs">{b.impact}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Solution overview */}
      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-white">The Solution</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🤖",
              title: "AI Carbon Measurement",
              desc: "IPCC Tier-2 emission factors + Sentinel-2 NDVI. ±8% accuracy. No auditor needed.",
            },
            {
              icon: "🔗",
              title: "Credit Pooling",
              desc: "200+ farms aggregate into one Verra-compliant bundle. $200/farm vs $80,000 alone.",
            },
            {
              icon: "⛓",
              title: "Blockchain Marketplace",
              desc: "ERC-1155 tokens on Polygon. 94% fraud reduction. Payment direct to mobile wallet in LKR.",
            },
          ].map((s) => (
            <div key={s.title} className="rounded-xl border border-white/10 bg-forest-light p-5 space-y-3">
              <div className="text-3xl">{s.icon}</div>
              <div className="text-white font-semibold">{s.title}</div>
              <div className="text-gray-400 text-sm">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why 2026 */}
      <section className="rounded-2xl border border-yellow-700/30 bg-yellow-900/10 p-6">
        <h3 className="text-yellow-300 font-bold text-lg mb-2">Why 2026 is the Right Moment</h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          The EU Carbon Border Adjustment Mechanism (CBAM) takes full effect in 2026.
          Sri Lankan exporters need verified carbon evidence to remain competitive in EU supply chains.
          CarbonMicro provides a local measurement-to-market pipeline for that demand.
        </p>
      </section>
    </div>
  );
}
