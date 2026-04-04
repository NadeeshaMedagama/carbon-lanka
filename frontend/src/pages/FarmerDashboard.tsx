import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWeb3 } from "../hooks/useWeb3";
import { api } from "../services/api";
import { formatUSD, formatLKR, formatTonnes, CROP_LABELS } from "../utils/formatters";
import type { SavedEstimate } from "../contexts/AuthContext";
import type { CreditTokenRecord, FarmRecord } from "../types";

const LKR_PER_USD = 310;

function claimBadgeClass(status: string): string {
  switch (status) {
    case "VERIFIED":   return "bg-carbon-900/40 border border-carbon-700/60 text-carbon-300";
    case "SUSPICIOUS": return "bg-yellow-900/30 border border-yellow-700/50 text-yellow-300";
    case "REJECTED":   return "bg-red-900/30 border border-red-700/50 text-red-300";
    default:           return "bg-white/5 border border-white/10 text-gray-400";
  }
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
}

function SummaryCard({ label, value, sub }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-1">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

interface EstimateCardProps {
  estimate: SavedEstimate;
}

function EstimateCard({ estimate }: EstimateCardProps) {
  const lkrMin = estimate.valueUsdMin * LKR_PER_USD;
  const lkrMax = estimate.valueUsdMax * LKR_PER_USD;
  const cropLabel = CROP_LABELS[estimate.cropType] ?? estimate.cropType;

  return (
    <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white font-semibold text-sm leading-tight">
            {estimate.farmName || "Unnamed Farm"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {estimate.district} &middot; {cropLabel}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${claimBadgeClass(estimate.claimStatus)}`}
        >
          {estimate.claimStatus || "UNVERIFIED"}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
          <div className="text-gray-500 mb-0.5">CO&#8322; volume</div>
          <div className="text-white font-medium">{formatTonnes(estimate.tonnes)}</div>
        </div>
        <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
          <div className="text-gray-500 mb-0.5">Value (USD)</div>
          <div className="text-white font-medium">
            {formatUSD(estimate.valueUsdMin)} &ndash; {formatUSD(estimate.valueUsdMax)}
          </div>
        </div>
        <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
          <div className="text-gray-500 mb-0.5">Value (LKR)</div>
          <div className="text-yellow-400 font-medium">
            {formatLKR(lkrMin)} &ndash; {formatLKR(lkrMax)}
          </div>
        </div>
        <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
          <div className="text-gray-500 mb-0.5">Confidence</div>
          <div className="text-carbon-400 font-medium">{estimate.confidence}%</div>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-gray-500">Saved {formatDate(estimate.savedAt)}</span>
        <Link
          to="/farmer"
          className="inline-flex items-center gap-1.5 text-xs text-carbon-400 hover:text-carbon-300 transition-colors font-medium"
        >
          View full estimate
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function FarmerDashboard() {
  const { user, logout } = useAuth();
  const { account, connect, connecting } = useWeb3();
  const navigate = useNavigate();
  const [mintedCredits, setMintedCredits] = useState<CreditTokenRecord[]>([]);
  const [retiredCredits, setRetiredCredits] = useState<CreditTokenRecord[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [pendingFarms, setPendingFarms] = useState<FarmRecord[]>([]);
  const [approvedFarms, setApprovedFarms] = useState<FarmRecord[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setCreditsLoading(true);
    Promise.all([api.listCredits(false), api.listRetiredCredits()])
      .then(([minted, retired]) => {
        setMintedCredits(minted);
        setRetiredCredits(retired);
      })
      .catch(() => {
        setMintedCredits([]);
        setRetiredCredits([]);
      })
      .finally(() => setCreditsLoading(false));
  }, []);

  useEffect(() => {
    setFarmsLoading(true);
    api.listFarms()
      .then((farms) => {
        setPendingFarms(farms.filter((f) => !f.admin_approved));
        setApprovedFarms(farms.filter((f) => f.admin_approved));
      })
      .catch(() => {
        setPendingFarms([]);
        setApprovedFarms([]);
      })
      .finally(() => setFarmsLoading(false));
  }, []);

  if (!user) return null;

  const estimates = user.savedEstimates;
  const totalTonnes = estimates.reduce((sum, e) => sum + e.tonnes, 0);
  const totalUsdMin = estimates.reduce((sum, e) => sum + e.valueUsdMin, 0);
  const totalUsdMax = estimates.reduce((sum, e) => sum + e.valueUsdMax, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user.name}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Your carbon estimate history and wallet status
          </p>
        </div>
        <div className="flex items-center gap-3">
          {account ? (
            <a
              href={`https://amoy.polygonscan.com/address/${account}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-900/40 border border-carbon-700/60 text-carbon-300 text-sm font-mono hover:border-carbon-600 transition-colors"
              title="View on Polygonscan"
            >
              <span className="w-2 h-2 rounded-full bg-carbon-500 shrink-0" />
              {shortAddress(account)}
              <svg className="w-3 h-3 shrink-0 text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2M9 2h5v5M14 2 7 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect wallet"
              )}
            </button>
          )}
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Wallet info banner when connected */}
      {account && (
        <div className="rounded-xl border border-carbon-700/40 bg-carbon-900/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-carbon-500 animate-pulse shrink-0" />
            <span className="text-carbon-300 font-mono text-xs">{account}</span>
          </div>
          <span className="text-gray-500 hidden sm:inline">&middot;</span>
          <a
            href={`https://amoy.polygonscan.com/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-carbon-400 hover:text-carbon-300 transition-colors text-xs"
          >
            View on Polygon Amoy Polygonscan
          </a>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total CO&#8322; estimated"
          value={formatTonnes(totalTonnes)}
          sub={estimates.length > 0 ? `across ${estimates.length} estimate${estimates.length !== 1 ? "s" : ""}` : "no estimates yet"}
        />
        <SummaryCard
          label="Value range (USD)"
          value={`${formatUSD(totalUsdMin)} \u2013 ${formatUSD(totalUsdMax)}`}
          sub="gross, before fees"
        />
        <SummaryCard
          label="Value range (LKR)"
          value={`${formatLKR(totalUsdMin * LKR_PER_USD)} \u2013 ${formatLKR(totalUsdMax * LKR_PER_USD)}`}
          sub={`at ${LKR_PER_USD} LKR/USD`}
        />
        <SummaryCard
          label="Wallet"
          value={account ? shortAddress(account) : "Not connected"}
          sub={account ? "Polygon Amoy" : "Connect to see balance"}
        />
      </div>

      {/* Pending Farm Submissions */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Pending Submissions</h2>
        <p className="text-gray-500 text-sm -mt-2">
          Farms awaiting admin verification before credits can be issued.
        </p>
        {farmsLoading ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <span className="w-5 h-5 border-2 border-amber-700/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading submissions...</span>
          </div>
        ) : pendingFarms.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-forest-light p-6 text-center text-gray-400 text-sm">
            No pending submissions. All your farms have been reviewed.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingFarms.map((farm) => (
              <div
                key={farm.id}
                className={`rounded-xl border-2 p-4 space-y-3 ${
                  farm.claim_status === "REJECTED"
                    ? "border-red-700/30 bg-red-950/20"
                    : farm.claim_status === "SUSPICIOUS"
                      ? "border-yellow-700/30 bg-yellow-950/15"
                      : "border-amber-600/30 bg-amber-950/10"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold text-sm leading-tight">
                      {farm.farmer_name || "Unnamed Farm"}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {farm.district} &middot; {CROP_LABELS[farm.crop_type] ?? farm.crop_type} &middot; #{farm.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${claimBadgeClass(farm.claim_status)}`}
                    >
                      {farm.claim_status}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-900/40 border border-amber-700/50 text-amber-300">
                      Pending
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">CO&#8322; estimate</div>
                    <div className="text-white font-medium">{formatTonnes(farm.estimated_tonnes_co2 ?? 0)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Land area</div>
                    <div className="text-white font-medium">{farm.land_area_ha.toFixed(2)} ha</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Submitted</div>
                    <div className="text-white font-medium">{formatDate(farm.created_at)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Proof</div>
                    <div className="font-medium">
                      {farm.land_proof_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}${farm.land_proof_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View doc
                        </a>
                      ) : (
                        <span className="text-red-400">Not uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status message */}
                {farm.claim_status === "REJECTED" ? (
                  <div className="rounded-lg bg-red-900/20 border border-red-700/20 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                    <span>&#10005;</span>
                    <span>Rejected{farm.claim_status_reason ? `: ${farm.claim_status_reason}` : ". Contact support for details."}</span>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-900/15 border border-amber-700/20 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span>Awaiting admin verification. You will be able to mint credits once approved.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Farms */}
      {approvedFarms.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Approved Farms</h2>
          <div className="space-y-3">
            {approvedFarms.map((farm) => (
              <div
                key={farm.id}
                className="rounded-xl border border-green-700/30 bg-green-950/10 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-white font-semibold text-sm">{farm.farmer_name}</div>
                  <div className="text-xs text-gray-400">{farm.district} &middot; {CROP_LABELS[farm.crop_type] ?? farm.crop_type} &middot; {formatTonnes(farm.estimated_tonnes_co2 ?? 0)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-900/40 border border-green-700/50 text-green-300">
                    Approved
                  </span>
                  {farm.land_proof_url && (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}${farm.land_proof_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Proof
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved estimates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">Saved Estimates</h2>
          <Link
            to="/farmer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-600 hover:bg-carbon-500 text-white text-xs font-medium transition-colors"
          >
            New estimate
          </Link>
        </div>

        {estimates.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-forest-light p-10 text-center space-y-3">
            <div className="text-4xl text-gray-600 select-none">&#x25A1;</div>
            <div className="text-white font-semibold">No estimates saved yet</div>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              Run the MRV workflow to generate a carbon estimate for your farm, then save it here.
            </p>
            <Link
              to="/farmer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon-600 hover:bg-carbon-500 text-white text-sm font-medium transition-colors"
            >
              Go to Measure
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <EstimateCard key={est.id} estimate={est} />
            ))}
          </div>
        )}
      </div>

      {/* Minted Credits (from backend) */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Minted Credits</h2>
        {creditsLoading ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <span className="w-5 h-5 border-2 border-carbon-700/30 border-t-carbon-400 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading minted credits...</span>
          </div>
        ) : mintedCredits.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-forest-light p-6 text-center text-gray-400 text-sm">
            No minted credits found. Mint credits from the farmer issuance flow.
          </div>
        ) : (
          <div className="space-y-3">
            {mintedCredits.map((credit) => (
              <div
                key={credit.token_id}
                className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold text-sm">
                      Token #{credit.token_id}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Farm #{credit.farm_id} &middot; Vintage {credit.vintage}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      credit.on_chain
                        ? "bg-green-900/40 border border-green-700/60 text-green-300"
                        : "bg-yellow-900/30 border border-yellow-700/50 text-yellow-300"
                    }`}
                  >
                    {credit.on_chain ? "On-Chain" : "Off-Chain"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">CO&#8322; volume</div>
                    <div className="text-white font-medium">{formatTonnes(credit.tonnes_co2)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Vintage</div>
                    <div className="text-white font-medium">{credit.vintage}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Tx Hash</div>
                    <div className="text-carbon-400 font-mono font-medium">
                      {credit.tx_hash
                        ? `${credit.tx_hash.slice(0, 6)}...${credit.tx_hash.slice(-4)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Minted</div>
                    <div className="text-white font-medium">{formatDate(credit.minted_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retired Credits (from backend) */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Retired Credits</h2>
        {creditsLoading ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <span className="w-5 h-5 border-2 border-carbon-700/30 border-t-carbon-400 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading retired credits...</span>
          </div>
        ) : retiredCredits.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-forest-light p-6 text-center text-gray-400 text-sm">
            No retired credits yet. Credits are retired when purchased by a buyer.
          </div>
        ) : (
          <div className="space-y-3">
            {retiredCredits.map((credit) => (
              <div
                key={credit.token_id}
                className="rounded-xl border border-red-700/20 bg-red-900/10 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold text-sm">
                      Token #{credit.token_id}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Farm #{credit.farm_id} &middot; Vintage {credit.vintage}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-900/40 border border-red-700/60 text-red-300">
                    Retired
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">CO&#8322; volume</div>
                    <div className="text-white font-medium">{formatTonnes(credit.tonnes_co2)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Vintage</div>
                    <div className="text-white font-medium">{credit.vintage}</div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Tx Hash</div>
                    <div className="text-carbon-400 font-mono font-medium">
                      {credit.tx_hash
                        ? `${credit.tx_hash.slice(0, 6)}...${credit.tx_hash.slice(-4)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-forest-dark/60 px-3 py-2">
                    <div className="text-gray-500 mb-0.5">Retired</div>
                    <div className="text-white font-medium">
                      {credit.retired_at ? formatDate(credit.retired_at) : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
