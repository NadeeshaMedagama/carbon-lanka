import { Link } from "react-router-dom";

const STATS = [
  { value: "50,000+", label: "Addressable t CO₂/yr" },
  { value: "$50B", label: "VCM Market 2030" },
  { value: "6%", label: "Platform fee" },
  { value: "94%", label: "Fraud reduction" },
  { value: "Rs 0", label: "Upfront cost" },
];

const BARRIERS = [
  {
    title: "Minimum Project Size",
    problem: "Verra requires 10,000–50,000 t CO₂/yr minimum.",
    impact: "A tea farm generates 20–500 t — up to 2,500× below threshold.",
  },
  {
    title: "Verification Cost",
    problem: "MRV auditors charge $15,000–$80,000 per project.",
    impact: "At $12/tonne, a 200-tonne farm earns $2,400. Verification costs $15,000.",
  },
  {
    title: "Technical Complexity",
    problem: "Applications require lawyers, consultants, 12–24 months.",
    impact: "No Sri Lankan smallholder has the time, literacy, or money.",
  },
  {
    title: "No Local Infrastructure",
    problem: "No Sri Lanka-specific carbon registry or MRV provider.",
    impact: "Foreign platforms don't serve projects below 1,000 tonnes.",
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-5">
        <div className="inline-block px-3 py-1 rounded-full border border-carbon-700/60 text-carbon-400 text-xs font-medium">
          CryptX 2.0 · Responsible AI &amp; Future of Work
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight">
          Carbon<span className="text-carbon-400">Micro</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
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
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-forest-light p-4 text-center">
            <div className="text-xl font-bold text-carbon-400">{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Problem */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">The Problem</h2>
          <p className="text-gray-400 mt-2">
            Sri Lanka has 2M hectares of agricultural land, 22% forest cover, and a
            rapidly growing renewable sector. The carbon value generated is real — but
            entirely unrealised. Four structural barriers lock out every smallholder farmer.
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
          Sri Lankan exporters need verified carbon offsets to avoid tariffs on goods
          entering Europe. Sri Lanka exported <strong className="text-white">LKR 1.8 trillion</strong> to EU
          countries in 2023 — a significant portion now faces CBAM exposure.
          CarbonLanka creates the supply side.
        </p>
      </section>
    </div>
  );
}
