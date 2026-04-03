import { useState } from "react";
import { FarmForm } from "../components/FarmForm/FarmForm";
import { CarbonEstimate } from "../components/CarbonEstimate/CarbonEstimate";
import { SatelliteView } from "../components/SatelliteView/SatelliteView";
import { useMRV } from "../hooks/useMRV";
import { api } from "../services/api";
import type { FarmInput, NDVITile, MRVResult } from "../types";
import { formatUSD, formatLKR, formatTonnes } from "../utils/formatters";

type Step = "form" | "estimate" | "satellite" | "pool" | "minted";

export default function FarmerPage() {
  const { result, loading, error, calculate, verifySatellite } = useMRV();
  const [step, setStep] = useState<Step>("form");
  const [currentFarm, setCurrentFarm] = useState<FarmInput | null>(null);
  const [ndvi, setNDVI] = useState<NDVITile | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [mintResult, setMintResult] = useState<{
    token_id: number;
    tx_hash: string;
    block_explorer_url: string;
    tonnes_co2: number;
  } | null>(null);
  const [minting, setMinting] = useState(false);

  const handleCalculate = async (farm: FarmInput) => {
    setCurrentFarm(farm);
    const res = await calculate(farm);
    if (res) setStep("estimate");
  };

  const handleVerify = async () => {
    if (!currentFarm || !result) return;
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
    } finally {
      setVerifying(false);
    }
  };

  const handleAddToPool = () => setStep("pool");

  const handleMint = async () => {
    if (!currentFarm || !result) return;
    setMinting(true);
    try {
      // Register farm first (gets a farm_id), then mint
      const farm = await api.registerFarm(currentFarm);
      await api.joinPool(farm.id);
      const mint = await api.mintCredit(farm.id);
      setMintResult({ ...mint, tonnes_co2: result.tonnes_co2_net });
      setStep("minted");
    } finally {
      setMinting(false);
    }
  };

  const reset = () => {
    setStep("form");
    setCurrentFarm(null);
    setNDVI(null);
    setMintResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Progress indicator */}
      <div className="flex items-center gap-1 mb-8">
        {(["form", "estimate", "satellite", "pool", "minted"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              step === s ? "bg-carbon-500 scale-125" :
              ["form","estimate","satellite","pool","minted"].indexOf(step) > i ? "bg-carbon-700" : "bg-white/15"
            }`} />
            {i < 4 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
        <span className="ml-3 text-xs text-gray-500 capitalize">{step}</span>
      </div>

      {/* Step: Form */}
      {step === "form" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Measure Your Carbon</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your farm details to get an AI-powered carbon estimate in seconds.</p>
          </div>
          {error && <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-red-300 text-sm">{error}</div>}
          <FarmForm onCalculate={handleCalculate} loading={loading} />
        </div>
      )}

      {/* Step: Estimate */}
      {step === "estimate" && result && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Carbon Estimate</h1>
            <p className="text-gray-400 text-sm mt-1">IPCC Tier-2 methodology · ±8% uncertainty</p>
          </div>
          <CarbonEstimate
            result={result}
            onVerifySatellite={handleVerify}
            onAddToPool={handleAddToPool}
            verifying={verifying}
          />
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">← Start over</button>
        </div>
      )}

      {/* Step: Satellite */}
      {step === "satellite" && result && ndvi && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Satellite Verification</h1>
            <p className="text-gray-400 text-sm mt-1">Sentinel-2 NDVI cross-check via Google Earth Engine</p>
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
            <h1 className="text-2xl font-bold text-white">Join the Aggregation Pool</h1>
            <p className="text-gray-400 text-sm mt-1">Your farm joins 200+ others to meet Verra's 10,000 t minimum.</p>
          </div>
          <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/20 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-forest-light p-3">
                <div className="text-gray-400 text-xs">Your contribution</div>
                <div className="text-white font-bold">{formatTonnes(result.tonnes_co2_net)}</div>
              </div>
              <div className="rounded-lg bg-forest-light p-3">
                <div className="text-gray-400 text-xs">Your gross value</div>
                <div className="text-white font-bold">{formatUSD(result.value_usd_min)} – {formatUSD(result.value_usd_max)}</div>
              </div>
              <div className="rounded-lg bg-forest-light p-3">
                <div className="text-gray-400 text-xs">Platform fee (6%)</div>
                <div className="text-white font-bold">{formatUSD((result.value_usd_min + result.value_usd_max) / 2 * 0.06)}</div>
              </div>
              <div className="rounded-lg bg-forest-light p-3">
                <div className="text-gray-400 text-xs">Shared MRV cost</div>
                <div className="text-white font-bold">$75 <span className="text-gray-400 font-normal text-xs">(split 200 ways)</span></div>
              </div>
            </div>
            <div className="rounded-lg bg-carbon-800/40 border border-carbon-600/40 p-3 flex items-center justify-between">
              <span className="text-gray-300 text-sm">Net to you (est.)</span>
              <div className="text-right">
                <div className="text-carbon-400 font-bold text-lg">
                  {formatUSD((result.value_usd_min + result.value_usd_max) / 2 * 0.94 - 75)}
                </div>
                <div className="text-yellow-400 text-xs">
                  {formatLKR((result.value_usd_min + result.value_usd_max) / 2 * 0.94 * 310 - 75 * 310)}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleMint}
            disabled={minting}
            className="w-full py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {minting ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Minting on Polygon…</>
            ) : (
              "⛓ Issue Credits on Blockchain"
            )}
          </button>
        </div>
      )}

      {/* Step: Minted */}
      {step === "minted" && mintResult && (
        <div className="space-y-6 text-center">
          <div className="text-5xl">🎉</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Credits Minted!</h1>
            <p className="text-gray-400 text-sm mt-1">Your carbon credits are live on the Polygon blockchain.</p>
          </div>
          <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/20 p-5 space-y-3 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Token ID</span>
              <span className="text-white font-mono">#{mintResult.token_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Volume</span>
              <span className="text-white">{formatTonnes(mintResult.tonnes_co2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network</span>
              <span className="text-purple-400">Polygon Mumbai Testnet</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Standard</span>
              <span className="text-blue-400">ERC-1155</span>
            </div>
            <div className="pt-2 border-t border-white/10">
              <a
                href={mintResult.block_explorer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-sm text-carbon-400 hover:text-carbon-300"
              >
                <span>View on Polygonscan</span>
                <span className="font-mono text-xs">{mintResult.tx_hash.slice(0, 12)}…</span>
              </a>
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            Your credits will appear in the marketplace once the pool is submitted to Verra.
          </p>
          <button onClick={reset} className="text-carbon-400 hover:text-carbon-300 text-sm underline">
            Register another farm
          </button>
        </div>
      )}
    </div>
  );
}
