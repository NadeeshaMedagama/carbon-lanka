import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MARKET_DATA = [
  { label: "Sri Lanka Yr 1", value: 0.15, color: "#22c55e" },
  { label: "Sri Lanka Yr 3", value: 2.4, color: "#16a34a" },
  { label: "South Asia Yr 5", value: 18, color: "#15803d" },
  { label: "Global VCM 2030", value: 50000, color: "#14532d" },
];

export default function Dashboard() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">ESG Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Carbon offset tracking · CBAM compliance · Market data</p>
      </div>

      {/* CBAM alert */}
      <div className="rounded-xl border border-yellow-600/40 bg-yellow-900/10 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-yellow-300 font-bold">EU CBAM — Effective 2026</div>
            <p className="text-gray-300 text-sm mt-1">
              The EU Carbon Border Adjustment Mechanism requires verified carbon certificates
              for goods exported to Europe. Sri Lankan exporters need CarbonMicro credits
              to avoid tariffs and maintain market access.
            </p>
            <button className="mt-3 px-4 py-1.5 rounded-lg border border-yellow-600/50 text-yellow-300 text-sm hover:bg-yellow-900/30 transition-colors">
              Download CBAM Certificate (Demo PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Revenue projections */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Market Size &amp; Revenue Projection</h2>
        <div className="rounded-xl border border-white/10 bg-forest-light p-5" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MARKET_DATA.slice(0, 3)} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a22" />
              <XAxis type="number" tickFormatter={(v) => `$${v}M`} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fill: "#d1d5db", fontSize: 11 }} width={120} />
              <Tooltip
                formatter={(v: number) => [`$${v}M USD`, "Revenue"]}
                contentStyle={{ background: "#132a1a", border: "1px solid #166534", color: "#fff" }}
              />
              <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-gray-500 text-xs text-center">
          Global VCM 2030 projected at $50B (McKinsey, 2023). CarbonMicro Year 1 target: $147K.
        </p>
      </div>

      {/* Revenue streams */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Revenue Streams</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs">
                <th className="text-left py-2 pr-4">Stream</th>
                <th className="text-left py-2 pr-4">Mechanism</th>
                <th className="text-left py-2 pr-4">Rate</th>
                <th className="text-right py-2">Year 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ["Transaction Fee", "6% of every credit sale", "$0.72–0.90/t", "$45,000"],
                ["MRV SaaS", "Annual subscription per project", "Rs 15K/proj", "$8,000"],
                ["ESG/CBAM API", "B2B API for EU exporters", "$200/co/mo", "$24,000"],
                ["Data Licensing", "Aggregate carbon analytics", "$10K/dataset", "$20,000"],
                ["MMDE Contract", "National carbon inventory", "Negotiated", "$50,000"],
              ].map(([s, m, r, y]) => (
                <tr key={s} className="text-gray-300">
                  <td className="py-2 pr-4 font-medium text-white">{s}</td>
                  <td className="py-2 pr-4 text-gray-400">{m}</td>
                  <td className="py-2 pr-4">{r}</td>
                  <td className="py-2 text-right text-carbon-400 font-semibold">{y}</td>
                </tr>
              ))}
              <tr className="border-t border-white/20 font-bold">
                <td colSpan={3} className="py-2 text-white">Total Year 1</td>
                <td className="py-2 text-right text-carbon-400">$147,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Research backbone */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Research Backbone</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: "AI-Based Agricultural MRV", src: "Clark et al., Nature Food (2024)", claim: "±8% farm-level accuracy with ML on IPCC Tier-2 data" },
            { title: "Google Earth Engine", src: "Gorelick et al., RSE (2017)", claim: "Free Sentinel-2 NDVI for independent verification" },
            { title: "Blockchain Carbon Integrity", src: "World Economic Forum (2023)", claim: "94% reduction in double-counting fraud" },
            { title: "VCM Scaling Blueprint", src: "McKinsey (2021/2023)", claim: "$50B VCM by 2030. Validates aggregation model" },
          ].map((r) => (
            <div key={r.title} className="rounded-lg border border-white/10 bg-forest-light p-3 space-y-1">
              <div className="text-white text-sm font-medium">{r.title}</div>
              <div className="text-gray-500 text-xs">{r.src}</div>
              <div className="text-gray-300 text-xs">{r.claim}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
