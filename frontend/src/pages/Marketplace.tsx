import { useState, useEffect } from "react";
import { CreditCard } from "../components/CreditCard/CreditCard";
import { PoolMap } from "../components/PoolMap/PoolMap";
import { api } from "../services/api";
import { useWeb3 } from "../hooks/useWeb3";
import type { CreditListing, PoolBundle, PayoutDisplay } from "../types";
import { formatUSD, formatLKR, formatTonnes } from "../utils/formatters";

export default function Marketplace() {
  const { account } = useWeb3();
  const [listings, setListings] = useState<CreditListing[]>([]);
  const [pool, setPool] = useState<PoolBundle | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [payout, setPayout] = useState<PayoutDisplay | null>(null);
  const [activeTab, setActiveTab] = useState<"listings" | "pool">("listings");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getListings(), api.getPool()])
      .then(([l, p]) => { setListings(l); setPool(p); })
      .catch(() => setLoadError("Could not connect to backend. Make sure the API is running at http://localhost:8000"));
  }, []);

  const handleBuy = async (credit: CreditListing) => {
    const buyer = account ?? "0xDEMO_BUYER_0000000000000000000000000000";
    setBuying(credit.token_id);
    setBuyError(null);
    try {
      const result = await api.buyCredit(credit.token_id, buyer, credit.price_per_tonne_usd);
      setPayout(result);
      setListings((prev) => prev.filter((l) => l.token_id !== credit.token_id));
    } catch {
      setBuyError("Purchase failed. The credit may already be retired, or backend connectivity is unavailable.");
    } finally {
      setBuying(null);
    }
  };

  const totalAvailable = listings.reduce((sum, item) => sum + item.tonnes_co2, 0);
  const avgPrice = listings.length
    ? listings.reduce((sum, item) => sum + item.price_per_tonne_usd, 0) / listings.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Carbon Credit Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Sri Lanka verified credits, tokenised on Polygon, with auditable retirement flow.</p>
        </div>
        <div className="text-xs text-gray-400 rounded-lg border border-white/10 bg-forest-light px-3 py-2">
          Buyer wallet: <span className="text-white font-mono">{account ?? "Demo buyer"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Listed credits</div>
          <div className="text-2xl font-bold text-white">{listings.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Available volume</div>
          <div className="text-2xl font-bold text-carbon-400">{formatTonnes(totalAvailable)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Average price / tonne</div>
          <div className="text-2xl font-bold text-white">{formatUSD(avgPrice)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-forest-light p-4">
          <div className="text-xs text-gray-400">Pool readiness</div>
          <div className="text-2xl font-bold text-white">{pool?.meets_verra_minimum ? "Verra Ready" : "Building"}</div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg bg-yellow-900/20 border border-yellow-700/30 p-4 text-yellow-300 text-sm">
          {loadError}
        </div>
      )}

      {buyError && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-4 text-red-300 text-sm">
          {buyError}
        </div>
      )}

      {/* Payout success banner */}
      {payout && (
        <div className="rounded-xl border border-carbon-600/60 bg-carbon-900/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💸</span>
            <div>
              <div className="text-white font-bold">Purchase Complete — Payout Sent!</div>
              <div className="text-gray-400 text-sm">Token #{payout.token_id} retired on-chain. Credit cannot be re-used.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-forest-light p-2">
              <div className="text-xs text-gray-400">Volume</div>
              <div className="text-white font-bold">{formatTonnes(payout.tonnes_co2)}</div>
            </div>
            <div className="rounded-lg bg-forest-light p-2">
              <div className="text-xs text-gray-400">Gross</div>
              <div className="text-white">{formatUSD(payout.gross_usd)}</div>
            </div>
            <div className="rounded-lg bg-forest-light p-2">
              <div className="text-xs text-gray-400">Net to Farmer</div>
              <div className="text-carbon-400 font-bold">{formatUSD(payout.net_usd)}</div>
            </div>
            <div className="rounded-lg bg-forest-light p-2">
              <div className="text-xs text-gray-400">LKR Payout</div>
              <div className="text-yellow-400 font-bold">{formatLKR(payout.net_lkr)}</div>
            </div>
          </div>
          <a
            href={payout.block_explorer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-carbon-400 hover:text-carbon-300 flex items-center gap-1"
          >
            View retirement on Polygonscan →
          </a>
          <button onClick={() => setPayout(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(["listings", "pool"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
              activeTab === tab
                ? "border-carbon-600/60 bg-carbon-900/30 text-carbon-300"
                : "border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            {tab === "listings" ? `Credits (${listings.length})` : "Pool Map"}
          </button>
        ))}
      </div>

      {/* Listings tab */}
      {activeTab === "listings" && (
        <>
          {listings.length === 0 && !loadError && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🌿</div>
              <div className="text-sm">No credits listed yet. Complete farm issuance flow first to publish credits.</div>
            </div>
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {listings.map((credit) => (
              <CreditCard
                key={credit.token_id}
                credit={credit}
                onBuy={handleBuy}
                buying={buying === credit.token_id}
              />
            ))}
          </div>
        </>
      )}

      {/* Pool tab */}
      {activeTab === "pool" && pool && (
        <PoolMap
          members={pool.pool_members}
          totalTonnes={pool.total_tonnes_co2}
          totalFarms={pool.total_farms}
          meetsMinimum={pool.meets_verra_minimum}
          verraMinimumTonnes={pool.verra_minimum_tonnes}
          totalMrvCostUsd={pool.shared_mrv_cost_usd}
        />
      )}

      {activeTab === "pool" && !pool && !loadError && (
        <div className="rounded-lg border border-white/10 bg-forest-light p-4 text-sm text-gray-400">
          Pool data is loading.
        </div>
      )}
    </div>
  );
}
