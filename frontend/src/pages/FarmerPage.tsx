import { useEffect, useState } from "react";
import { FarmForm } from "../components/FarmForm/FarmForm";
import { CarbonEstimate } from "../components/CarbonEstimate/CarbonEstimate";
import { SatelliteView } from "../components/SatelliteView/SatelliteView";
import { useMRV } from "../hooks/useMRV";
import { api } from "../services/api";
import type { FarmInput, NDVITile, PoolBundle } from "../types";
import { formatUSD, formatLKR, formatTonnes } from "../utils/formatters";

type Step = "form" | "estimate" | "satellite" | "pool" | "minted";

const STEPS: { key: Step; label: string; helper: string }[] = [
  { key: "form", label: "Farm Input", helper: "Collect activity data" },
  { key: "estimate", label: "AI Estimate", helper: "Calculate CO2 and value" },
  { key: "satellite", label: "Satellite Check", helper: "Validate with NDVI" },
  { key: "pool", label: "Pool & Issue", helper: "Aggregate and mint" },
  { key: "minted", label: "Complete", helper: "Credit created on-chain" },
];

export default function FarmerPage() {
  const { result, loading, error, calculate, verifySatellite } = useMRV();
  const [step, setStep] = useState<Step>("form");
  const [currentFarm, setCurrentFarm] = useState<FarmInput | null>(null);
  const [ndvi, setNDVI] = useState<NDVITile | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<{
    token_id: number;
    tx_hash: string;
    block_explorer_url: string;
    tonnes_co2: number;
  } | null>(null);
  const [minting, setMinting] = useState(false);
  const [poolSnapshot, setPoolSnapshot] = useState<PoolBundle | null>(null);

  const handleCalculate = async (farm: FarmInput) => {
    setActionError(null);
    setCurrentFarm(farm);
    const res = await calculate(farm);
    if (res) setStep("estimate");
  };

  const handleVerify = async () => {
    if (!currentFarm || !result) return;
    setActionError(null);
    setVerifying(true);
    try {
      const verified = await verifySatellite(currentFarm, currentFarm.latitude, currentFarm.longitude);
      if (verified) {
        const tile = await api.getNDVITile(
          currentFarm.crop_type,
          currentFarm.latitude ?? 6.9271,
          currentFarm.longitude ?? 80.7718,
        );
        setNDVI(tile);
        setStep("satellite");
      }
    } catch {
      setActionError("Satellite verification could not be completed. Please retry.");
    } finally {
      setVerifying(false);
    }
  };

  const handleAddToPool = () => setStep("pool");

  useEffect(() => {
    if (step !== "pool") return;
    api.getPool().then(setPoolSnapshot).catch(() => setPoolSnapshot(null));
  }, [step]);

  const handleMint = async () => {
    if (!currentFarm || !result) return;
    setActionError(null);
    setMinting(true);
    try {
      // Register farm first (gets a farm_id), then mint
      const farm = await api.registerFarm(currentFarm);
      await api.joinPool(farm.id);
      const mint = await api.mintCredit(farm.id);
      setMintResult({ ...mint, tonnes_co2: result.tonnes_co2_net });
      setStep("minted");
    } catch {
      setActionError("Minting failed. Check backend and wallet configuration, then try again.");
    } finally {
      setMinting(false);
    }
  };

  const reset = () => {
    setStep("form");
    setCurrentFarm(null);
    setNDVI(null);
    setMintResult(null);
    setActionError(null);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const avgUsd = result ? (result.value_usd_min + result.value_usd_max) / 2 : 0;
  const avgLkr = result ? (result.value_lkr_min + result.value_lkr_max) / 2 : 0;
  const usdToLkr = avgUsd > 0 ? avgLkr / avgUsd : 0;
  const sharedMrvCostPerFarm = poolSnapshot && poolSnapshot.total_farms > 0
    ? poolSnapshot.shared_mrv_cost_usd / poolSnapshot.total_farms
    : 0;
  const netUsd = avgUsd * 0.94 - sharedMrvCostPerFarm;
  const netLkr = netUsd * usdToLkr;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Farmer MRV Workflow</h1>
        <p className="text-gray-400 text-sm">
          Complete a farm submission, verify with satellite evidence, then issue tokenised credits to the pool.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="rounded-xl border border-white/10 bg-forest-light p-4">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {STEPS.map((item, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <div
                key={item.key}
                className={`rounded-lg border p-3 transition-colors ${
                  active
                    ? "border-carbon-600/50 bg-carbon-900/30"
                    : done
                      ? "border-carbon-800/50 bg-carbon-900/10"
                      : "border-white/10 bg-forest-dark/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                      active
                        ? "bg-carbon-500 text-white"
                        : done
                          ? "bg-carbon-800 text-carbon-300"
                          : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-white text-sm font-medium">{item.label}</span>
                </div>
                <div className="text-xs text-gray-400">{item.helper}</div>
              </div>
            );
          })}
        </div>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-red-300 text-sm">
          {actionError ?? error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Step: Form */}
          {step === "form" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 1: Submit Farm Details</h2>
                <p className="text-gray-400 text-sm mt-1">Use the guided form to generate an AI carbon estimate in seconds.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-forest-light p-5">
                <FarmForm onCalculate={handleCalculate} loading={loading} />
              </div>
            </div>
          )}

          {/* Step: Estimate */}
          {step === "estimate" && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 2: Review AI Estimate</h2>
                <p className="text-gray-400 text-sm mt-1">IPCC Tier-2 methodology with uncertainty and confidence scoring.</p>
              </div>
              <CarbonEstimate
                result={result}
                onVerifySatellite={handleVerify}
                onAddToPool={handleAddToPool}
                verifying={verifying}
              />
            </div>
          )}

          {/* Step: Satellite */}
          {step === "satellite" && result && ndvi && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 3: Satellite Verification</h2>
                <p className="text-gray-400 text-sm mt-1">Sentinel-2 NDVI corroboration via Google Earth Engine.</p>
              </div>
              <SatelliteView ndvi={ndvi} />
              <CarbonEstimate
                result={result}
                onVerifySatellite={handleVerify}
                onAddToPool={handleAddToPool}
                verifying={verifying}
              />
            </div>
          )}

          {/* Step: Pool */}
          {step === "pool" && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 4: Join Pool and Issue Credits</h2>
                <p className="text-gray-400 text-sm mt-1">Aggregate with smallholders to meet marketplace and registry thresholds.</p>
              </div>
              <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/20 p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Your contribution</div>
                    <div className="text-white font-bold">{formatTonnes(result.tonnes_co2_net)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Gross value range</div>
                    <div className="text-white font-bold">{formatUSD(result.value_usd_min)} - {formatUSD(result.value_usd_max)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Platform fee (6%)</div>
                    <div className="text-white font-bold">{formatUSD(avgUsd * 0.06)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Shared MRV cost</div>
                    <div className="text-white font-bold">
                      {formatUSD(sharedMrvCostPerFarm)}
                      {poolSnapshot && (
                        <span className="text-gray-400 font-normal text-xs"> (split {poolSnapshot.total_farms} ways)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-carbon-800/40 border border-carbon-600/40 p-3 flex items-center justify-between gap-3">
                  <span className="text-gray-300 text-sm">Estimated net payout</span>
                  <div className="text-right">
                    <div className="text-carbon-400 font-bold text-lg">{formatUSD(netUsd)}</div>
                    <div className="text-yellow-400 text-xs">{formatLKR(netLkr)}</div>
                  </div>
                </div>
              </div>

              {poolSnapshot && (
                <div className="text-xs text-gray-400 rounded-lg border border-white/10 bg-forest-light p-3">
                  Current pool progress: {formatTonnes(poolSnapshot.total_tonnes_co2)} / {formatTonnes(poolSnapshot.verra_minimum_tonnes)}
                </div>
              )}

              <button
                onClick={handleMint}
                disabled={minting}
                className="w-full py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {minting ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Minting on Polygon...</>
                ) : (
                  "Issue Credits on Blockchain"
                )}
              </button>
            </div>
          )}

          {/* Step: Minted */}
          {step === "minted" && mintResult && (
            <div className="space-y-6">
              <div className="rounded-xl border border-carbon-700/60 bg-carbon-900/30 p-6 space-y-4">
                <div className="text-4xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Step 5: Credits Issued Successfully</h2>
                  <p className="text-gray-400 text-sm mt-1">Token minted on Polygon and ready for marketplace listing and retirement.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-forest-light p-3 flex justify-between">
                    <span className="text-gray-400">Token ID</span>
                    <span className="text-white font-mono">#{mintResult.token_id}</span>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3 flex justify-between">
                    <span className="text-gray-400">Volume</span>
                    <span className="text-white">{formatTonnes(mintResult.tonnes_co2)}</span>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3 flex justify-between">
                    <span className="text-gray-400">Network</span>
                    <span className="text-purple-400">Polygon Mumbai</span>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3 flex justify-between">
                    <span className="text-gray-400">Standard</span>
                    <span className="text-blue-400">ERC-1155</span>
                  </div>
                </div>
                <a
                  href={mintResult.block_explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-carbon-400 hover:text-carbon-300"
                >
                  View transaction on Polygonscan
                </a>
              </div>
            </div>
          )}

          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">Start over</button>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-2">
            <div className="text-sm font-semibold text-white">What judges should see</div>
            <ul className="text-xs text-gray-400 space-y-1.5">
              <li>10-second AI estimate from simple farm input.</li>
              <li>Satellite NDVI cross-check for fraud prevention.</li>
              <li>Pooling economics that make small farms viable.</li>
              <li>Live mint transaction on Polygon testnet.</li>
              <li>Clear net payout in USD and LKR.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-forest-light p-4">
            <div className="text-xs text-gray-400 mb-2">Current status</div>
            <div className="text-sm text-white font-medium">{STEPS[stepIndex]?.label}</div>
            {result && (
              <div className="mt-3 text-xs text-gray-400 space-y-1">
                <div className="flex justify-between"><span>Estimated volume</span><span className="text-white">{formatTonnes(result.tonnes_co2_net)}</span></div>
                <div className="flex justify-between"><span>Avg value</span><span className="text-white">{formatUSD(avgUsd)}</span></div>
                <div className="flex justify-between"><span>Confidence</span><span className="text-carbon-400">{result.confidence_score}%</span></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
