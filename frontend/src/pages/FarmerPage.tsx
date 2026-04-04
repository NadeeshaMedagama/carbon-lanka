import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FarmForm } from "../components/FarmForm/FarmForm";
import { CarbonEstimate } from "../components/CarbonEstimate/CarbonEstimate";
import { SatelliteView } from "../components/SatelliteView/SatelliteView";
import { AnalyzingView } from "../components/AnalyzingView/AnalyzingView";
import { useMRV } from "../hooks/useMRV";
import { useWeb3 } from "../hooks/useWeb3";
import { api } from "../services/api";
import type { FarmInput, NDVITile, PoolBundle } from "../types";
import { formatUSD, formatLKR, formatTonnes } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";

type Step = "form" | "estimate" | "satellite" | "pool" | "minted" | "pending_approval";

const STEPS: { key: Step; label: string; helper: string }[] = [
  { key: "form", label: "Farm Input", helper: "Collect activity data & proof" },
  { key: "estimate", label: "KGML Estimate", helper: "IPCC + KGML ensemble carbon calculation" },
  { key: "satellite", label: "Satellite Check", helper: "Validate with NDVI" },
  { key: "pending_approval", label: "Admin Review", helper: "Wait for land verification" },
  { key: "pool", label: "Pool & Issue", helper: "Aggregate and mint" },
  { key: "minted", label: "Complete", helper: "Credit created on-chain" },
];

export default function FarmerPage() {
  const { result, loading, error, calculateKGML, verifySatellite, kgmlStatus } = useMRV();
  const { user, saveEstimate } = useAuth();
  const { account } = useWeb3();

  const [step, setStep] = useState<Step>("form");
  const [currentFarm, setCurrentFarm] = useState<FarmInput | null>(null);
  const [ndvi, setNDVI] = useState<NDVITile | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analyzingNdvi, setAnalyzingNdvi] = useState<NDVITile | null>(null);
  const [ndviLoading, setNdviLoading] = useState(false);
  const [mintResult, setMintResult] = useState<{
    token_id: number;
    tx_hash: string;
    block_explorer_url: string;
    tonnes_co2: number;
  } | null>(null);
  const [minting, setMinting] = useState(false);
  const [poolSnapshot, setPoolSnapshot] = useState<PoolBundle | null>(null);
  const [proofFile, setProofFile] = useState<File | undefined>(undefined);
  const [registeredFarmId, setRegisteredFarmId] = useState<number | null>(null);

  const handleCalculate = async (farm: FarmInput, proof?: File) => {
    setProofFile(proof);
    setActionError(null);
    setCurrentFarm(farm);
    setAnalyzingNdvi(null);

    // Fetch NDVI tile in parallel so AnalyzingView can show it while API runs
    setNdviLoading(true);
    api
      .getNDVITile(farm.crop_type, farm.latitude ?? 6.9271, farm.longitude ?? 80.7718)
      .then((tile) => setAnalyzingNdvi(tile))
      .catch(() => setAnalyzingNdvi(null))
      .finally(() => setNdviLoading(false));

    const res = await calculateKGML(farm, farm.latitude, farm.longitude);
    if (res) {
      setStep("estimate");

      // If flagged/rejected, register the farm immediately so it appears
      // in the admin review queue (minting is blocked, so handleMint won't run).
      if (res.claim_status === "REJECTED" || res.anomaly_flag) {
        try {
          await api.registerFarm({
            ...farm,
            claim_status: res.claim_status,
            claim_status_reason: res.claim_status_reason,
            anomaly_flag: res.anomaly_flag,
          });
        } catch {
          // Farm registration for review is best-effort; don't block the UI.
        }
      }
    }
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

  const handleSubmitForApproval = async () => {
    if (!result || !currentFarm) return;
    if (result.claim_status === "REJECTED" || result.anomaly_flag) return;
    setActionError(null);
    setMinting(true);
    try {
      const farmPayload = {
        ...currentFarm,
        claim_status: result.claim_status,
        claim_status_reason: result.claim_status_reason,
        anomaly_flag: result.anomaly_flag,
      };
      const farm = await api.registerFarm(farmPayload);
      setRegisteredFarmId(farm.id);
      // Upload proof document
      if (proofFile) {
        await api.uploadLandProof(farm.id, proofFile);
      }
      setStep("pending_approval");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(detail ?? "Failed to submit farm for approval.");
    } finally {
      setMinting(false);
    }
  };

  useEffect(() => {
    if (step !== "pool") return;
    api.getPool().then(setPoolSnapshot).catch(() => setPoolSnapshot(null));
  }, [step]);

  const handleMint = async () => {
    if (!currentFarm || !result || !registeredFarmId) return;
    setActionError(null);
    setMinting(true);
    try {
      await api.joinPool(registeredFarmId);
      const mint = await api.mintCredit(registeredFarmId, account ?? undefined);
      setMintResult({ ...mint, tonnes_co2: result.tonnes_co2_net });
      if (user) {
        saveEstimate({
          farmName: currentFarm?.farmer_name ?? "Unnamed farm",
          district: currentFarm?.district ?? "Unknown",
          cropType: result.crop_type,
          tonnes: result.tonnes_co2_net,
          valueUsdMin: result.value_usd_min,
          valueUsdMax: result.value_usd_max,
          confidence: result.confidence_score,
          claimStatus: result.claim_status,
        });
      }
      setStep("minted");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(detail ?? "Minting failed. Check backend and wallet configuration, then try again.");
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
    setAnalyzingNdvi(null);
    setNdviLoading(false);
    setProofFile(undefined);
    setRegisteredFarmId(null);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const avgUsd = result ? (result.value_usd_min + result.value_usd_max) / 2 : 0;
  const avgLkr = result ? (result.value_lkr_min + result.value_lkr_max) / 2 : 0;
  const usdToLkr = avgUsd > 0 ? avgLkr / avgUsd : 0;
  const sharedMrvCostPerFarm =
    poolSnapshot && poolSnapshot.total_farms > 0
      ? poolSnapshot.shared_mrv_cost_usd / poolSnapshot.total_farms
      : 0;
  const netUsd = avgUsd * 0.94 - sharedMrvCostPerFarm;
  const netLkr = netUsd * usdToLkr;

  const claimColor = (status: string) => {
    switch (status) {
      case "VERIFIED":   return "text-green-400";
      case "SUSPICIOUS": return "text-yellow-400";
      case "REJECTED":   return "text-red-400";
      default:           return "text-gray-400";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Page title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Measure Your Farm's Carbon</h1>
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

      {/* Two-column layout: main content + status sidebar */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* ── Main content ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Step: Form */}
          {step === "form" && !loading && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 1: Submit Farm Details</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Enter your farm details to get an AI carbon estimate in seconds.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-forest-light p-5">
                <FarmForm onCalculate={handleCalculate} loading={loading} />
              </div>
            </div>
          )}

          {/* Analyzing: shown while loading after form submit */}
          {step === "form" && loading && currentFarm && (
            <div className="rounded-xl border border-white/10 bg-forest-light p-5">
              <AnalyzingView
                farm={currentFarm}
                ndviTile={analyzingNdvi}
                ndviLoading={ndviLoading}
              />
            </div>
          )}

          {/* Step: Estimate */}
          {step === "estimate" && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 2: KGML Ensemble Estimate</h2>
                <p className="text-gray-400 text-sm mt-1">
                  5-step pipeline: IPCC Eq.2.25 SOC stock-change + KGML-ag-Carbon GRU ensemble with physics-constrained mass balance.
                </p>
              </div>
              <CarbonEstimate
                result={result}
                onVerifySatellite={handleVerify}
                onAddToPool={handleSubmitForApproval}
                verifying={verifying}
              />
            </div>
          )}

          {/* Step: Satellite */}
          {step === "satellite" && result && ndvi && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 3: Satellite Verification</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Sentinel-2 NDVI corroboration via Google Earth Engine.
                </p>
              </div>
              <SatelliteView ndvi={ndvi} />
              <CarbonEstimate
                result={result}
                onVerifySatellite={handleVerify}
                onAddToPool={handleSubmitForApproval}
                verifying={verifying}
              />
            </div>
          )}

          {/* Step: Pending Admin Approval */}
          {step === "pending_approval" && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 4: Pending Admin Verification</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Your farm and land proof documents have been submitted. An admin must verify your land ownership before credits can be issued.
                </p>
              </div>
              <div className="rounded-xl border-2 border-amber-600/40 bg-amber-950/20 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-amber-400 text-2xl leading-none mt-0.5">&#9203;</span>
                  <div>
                    <div className="text-amber-300 font-bold text-base">Awaiting Admin Approval</div>
                    <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                      Your farm submission (#{registeredFarmId}) is under review. The admin will verify your land ownership documents before you can proceed to mint carbon credits on the blockchain.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-900/15 border border-amber-700/20 p-3 text-xs text-gray-400 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span>Farm registered and proof documents uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span>KGML carbon estimate: {formatTonnes(result.tonnes_co2_net)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                    <span>Admin land ownership verification — in progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
                    <span>Pool entry and blockchain minting — waiting for approval</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Once approved, your credits will be <span className="text-carbon-400 font-medium">automatically minted</span> and listed on the marketplace.
                </p>
                <Link
                  to="/my-farm"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon-600 hover:bg-carbon-500 text-white text-sm font-medium transition-colors"
                >
                  Check My Farm Dashboard &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Step: Pool */}
          {step === "pool" && result && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Step 4: Join Pool and Issue Credits</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Aggregate with smallholders to meet marketplace and registry thresholds.
                </p>
              </div>
              <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/20 p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Your contribution</div>
                    <div className="text-white font-bold">{formatTonnes(result.tonnes_co2_net)}</div>
                  </div>
                  <div className="rounded-lg bg-forest-light p-3">
                    <div className="text-gray-400 text-xs">Gross value range</div>
                    <div className="text-white font-bold">
                      {formatUSD(result.value_usd_min)} – {formatUSD(result.value_usd_max)}
                    </div>
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
                        <span className="text-gray-400 font-normal text-xs">
                          {" "}(split {poolSnapshot.total_farms} ways)
                        </span>
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

              {(result.claim_status === "REJECTED" || result.anomaly_flag) ? (
                <div className="rounded-xl border-2 border-red-600/60 bg-red-950/40 p-4 text-center space-y-1">
                  <div className="text-red-300 font-bold">&#9888; Submission Flagged</div>
                  <p className="text-gray-400 text-sm">
                    This farm has been flagged for manual review. Credits cannot be issued until the review is complete.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={minting}
                  className="w-full py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {minting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Minting on Polygon...
                    </>
                  ) : (
                    "Issue Credits on Blockchain"
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step: Minted */}
          {step === "minted" && mintResult && (
            <div className="space-y-6">
              <div className="rounded-xl border border-carbon-700/60 bg-carbon-900/30 p-6 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Credits Issued Successfully</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Token minted on Polygon and ready for marketplace listing and retirement.
                  </p>
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
                    <span className="text-carbon-400">Polygon Amoy</span>
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

          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">
            Start over
          </button>
        </div>

        {/* ── Status sidebar ────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border border-white/10 bg-forest-light p-4">
            <div className="text-sm font-semibold text-white mb-2">Your Estimate</div>
            <div className="text-xs text-gray-400 mb-3">Current step</div>
            <div className="text-sm text-white font-medium">{STEPS[stepIndex]?.label}</div>

            {result && (
              <div className="mt-3 text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Estimated volume</span>
                  <span className="text-white">{formatTonnes(result.tonnes_co2_net)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg value</span>
                  <span className="text-white">{formatUSD(avgUsd)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence</span>
                  <span className="text-carbon-400">{result.confidence_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tier</span>
                  <span className="text-white">{result.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span>Claim status</span>
                  <span className={claimColor(result.claim_status)}>{result.claim_status}</span>
                </div>
              </div>
            )}

            {kgmlStatus && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 space-y-1">
                <div className="text-gray-500 font-medium mb-1">KGML Pipeline</div>
                <div className="flex justify-between">
                  <span>KGML model</span>
                  <span className={kgmlStatus.kgml_model_loaded ? "text-green-400" : "text-red-400"}>
                    {kgmlStatus.kgml_model_loaded ? "Loaded" : "Offline"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GEE connection</span>
                  <span className={kgmlStatus.gee_connected ? "text-green-400" : "text-red-400"}>
                    {kgmlStatus.gee_connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            )}

            {/* Prompt sign-in only if not logged in and estimate is ready but not yet minted */}
            {result && !user && step !== "minted" && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  <Link to="/auth" className="text-carbon-400 hover:text-carbon-300 font-medium">
                    Sign in
                  </Link>{" "}
                  to save this estimate to your dashboard.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
