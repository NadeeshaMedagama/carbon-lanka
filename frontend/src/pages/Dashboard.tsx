import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../services/api";
import type { CreditListing, CreditTokenRecord, FarmRecord, PoolBundle, KGMLStatus, BlockchainHealth } from "../types";
import { CROP_LABELS, formatLKR, formatTonnes, formatUSD } from "../utils/formatters";

function StatusDot({ color }: { color: "green" | "red" | "yellow" }) {
  const cls =
    color === "green"
      ? "bg-green-400 shadow-green-400/50"
      : color === "yellow"
        ? "bg-yellow-400 shadow-yellow-400/50"
        : "bg-red-400 shadow-red-400/50";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-sm ${cls}`} />;
}

export default function Dashboard() {
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [pool, setPool] = useState<PoolBundle | null>(null);
  const [listings, setListings] = useState<CreditListing[]>([]);
  const [retired, setRetired] = useState<CreditTokenRecord[]>([]);
  const [kgmlStatus, setKgmlStatus] = useState<KGMLStatus | null>(null);
  const [blockchainHealth, setBlockchainHealth] = useState<BlockchainHealth | null>(null);

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

    // Fetch MRV pipeline health
    api.getKGMLStatus().then(setKgmlStatus).catch(() => setKgmlStatus(null));
    api.getBlockchainHealth().then(setBlockchainHealth).catch(() => setBlockchainHealth(null));
  }, []);

  const pooledFarms = useMemo(() => farms.filter((f) => f.in_pool).length, [farms]);
  const listedValue = useMemo(() => listings.reduce((sum, l) => sum + l.price_usd, 0), [listings]);
  const listedTonnes = useMemo(() => listings.reduce((sum, l) => sum + l.tonnes_co2, 0), [listings]);
  const usdToLkr = useMemo(() => {
    if (pool && pool.net_to_farmers_usd > 0) return pool.net_to_farmers_lkr / pool.net_to_farmers_usd;
    if (listings.length > 0 && listings[0].price_usd > 0) return listings[0].price_lkr / listings[0].price_usd;
    return 0;
  }, [listings, pool]);

  const districtData = useMemo(() => {
    const byDistrict = new Map<string, number>();
    for (const member of pool?.pool_members ?? []) {
      byDistrict.set(member.district, (byDistrict.get(member.district) ?? 0) + member.tonnes_co2);
    }
    return Array.from(byDistrict.entries())
      .map(([district, tonnes]) => ({ district, tonnes: Number(tonnes.toFixed(2)) }))
      .sort((a, b) => b.tonnes - a.tonnes)
      .slice(0, 6);
  }, [pool?.pool_members]);

  const cropData = useMemo(() => {
    const byCrop = new Map<string, number>();
    for (const farm of farms) {
      if (!farm.estimated_tonnes_co2) continue;
      byCrop.set(farm.crop_type, (byCrop.get(farm.crop_type) ?? 0) + farm.estimated_tonnes_co2);
    }
    return Array.from(byCrop.entries())
      .map(([crop, tonnes]) => ({
        crop: CROP_LABELS[crop] ?? crop,
        tonnes: Number(tonnes.toFixed(2)),
      }))
      .sort((a, b) => b.tonnes - a.tonnes)
      .slice(0, 6);
  }, [farms]);

  const truncateAddress = (addr: string | undefined | null) => {
    if (!addr) return null;
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">ESG Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Live performance view sourced from current platform database records.</p>
      </div>

      {/* ── MRV Pipeline Health ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">MRV Pipeline Health</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KGML Model */}
          <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
            <div className="text-xs text-gray-400">KGML Model</div>
            <div className="flex items-center gap-2">
              {kgmlStatus ? (
                <>
                  <StatusDot color={kgmlStatus.kgml_model_loaded ? "green" : "red"} />
                  <span className={`text-sm font-semibold ${kgmlStatus.kgml_model_loaded ? "text-green-400" : "text-red-400"}`}>
                    {kgmlStatus.kgml_model_loaded ? "Loaded" : "Not Loaded"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
          </div>

          {/* GEE Connection */}
          <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
            <div className="text-xs text-gray-400">GEE Connection</div>
            <div className="flex items-center gap-2">
              {kgmlStatus ? (
                <>
                  <StatusDot color={kgmlStatus.gee_connected ? "green" : "red"} />
                  <span className={`text-sm font-semibold ${kgmlStatus.gee_connected ? "text-green-400" : "text-red-400"}`}>
                    {kgmlStatus.gee_connected ? "Connected" : "Disconnected"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
          </div>

          {/* Blockchain */}
          <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
            <div className="text-xs text-gray-400">Blockchain</div>
            <div className="flex items-center gap-2">
              {blockchainHealth ? (
                <>
                  <StatusDot color={blockchainHealth.enabled && blockchainHealth.connected ? "green" : "yellow"} />
                  <span
                    className={`text-sm font-semibold ${
                      blockchainHealth.enabled && blockchainHealth.connected ? "text-green-400" : "text-yellow-400"
                    }`}
                  >
                    {blockchainHealth.enabled && blockchainHealth.connected ? "Enabled" : "Demo Mode"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
          </div>

          {/* Smart Contract */}
          <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
            <div className="text-xs text-gray-400">Smart Contract</div>
            <div className="flex items-center gap-2">
              {blockchainHealth ? (
                blockchainHealth.contract_address ? (
                  <span className="text-sm font-mono font-semibold text-carbon-400" title={blockchainHealth.contract_address}>
                    {truncateAddress(blockchainHealth.contract_address)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-gray-500">Not Deployed</span>
                )
              ) : (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Existing KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Registered farms</div>
          <div className="text-2xl font-bold text-white">{farms.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Farms in pool</div>
          <div className="text-2xl font-bold text-carbon-400">{pooledFarms}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Pooled CO2</div>
          <div className="text-2xl font-bold text-white">{pool ? formatTonnes(pool.total_tonnes_co2) : "-"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Retired credits</div>
          <div className="text-2xl font-bold text-carbon-400">{retired.length}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Live listings</div>
          <div className="text-xl font-bold text-white">{listings.length}</div>
          <div className="text-xs text-gray-500 mt-1">{formatTonnes(listedTonnes)} available</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Listing value</div>
          <div className="text-xl font-bold text-white">{formatUSD(listedValue)}</div>
          <div className="text-xs text-gray-500 mt-1">{usdToLkr > 0 ? formatLKR(listedValue * usdToLkr) : "LKR rate unavailable"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Pool net to farmers</div>
          <div className="text-xl font-bold text-carbon-400">{pool ? formatUSD(pool.net_to_farmers_usd) : "-"}</div>
          <div className="text-xs text-gray-500 mt-1">After platform fee and MRV share</div>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-600/40 bg-yellow-900/10 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-yellow-300 font-bold">CBAM Readiness Monitor</div>
            <p className="text-gray-300 text-sm mt-1">
              Track verified pooled volume and retired credits to demonstrate auditable carbon activity for export-facing stakeholders.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Pooled Tonnes by District</h2>
        <div className="rounded-xl border border-white/10 bg-forest-light p-5" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={districtData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a22" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis type="category" dataKey="district" tick={{ fill: "#d1d5db", fontSize: 11 }} width={90} />
              <Tooltip
                formatter={(v: number) => [formatTonnes(v), "CO2 volume"]}
                contentStyle={{ background: "#132a1a", border: "1px solid #166534", color: "#fff" }}
              />
              <Bar dataKey="tonnes" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Estimated Tonnes by Crop</h2>
        <div className="rounded-xl border border-white/10 bg-forest-light p-5" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cropData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a22" />
              <XAxis dataKey="crop" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [formatTonnes(v), "Estimated CO2"]}
                contentStyle={{ background: "#132a1a", border: "1px solid #166534", color: "#fff" }}
              />
              <Bar dataKey="tonnes" fill="#4ade80" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/20 p-5 text-sm text-gray-300">
        This dashboard is generated from live database records (farms, pooled estimates, minted listings, and retired credits)
        to keep operations and reporting synchronized with actual platform activity.
      </div>
    </div>
  );
}
