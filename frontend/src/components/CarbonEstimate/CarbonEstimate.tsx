import { useState } from "react";
import type { MRVResult } from "../../types";
import { formatUSD, formatLKR, formatTonnes } from "../../utils/formatters";

interface Props {
  result: MRVResult;
  onVerifySatellite: () => void;
  onAddToPool: () => void;
  verifying: boolean;
}

const CLAIM_STYLES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  VERIFIED: {
    border: "border-green-500/60",
    bg: "bg-green-500/10",
    text: "text-green-400",
    dot: "bg-green-400",
  },
  UNVERIFIED: {
    border: "border-gray-500/60",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    dot: "bg-gray-400",
  },
  SUSPICIOUS: {
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  REJECTED: {
    border: "border-red-500/60",
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
  },
};

export function CarbonEstimate({ result, onVerifySatellite, onAddToPool, verifying }: Props) {
  const [socOpen, setSocOpen] = useState(false);

  const avgUSD = (result.value_usd_min + result.value_usd_max) / 2;
  const avgLKR = (result.value_lkr_min + result.value_lkr_max) / 2;
  const confidenceLabel =
    result.confidence_score >= 90 ? "High" : result.confidence_score >= 75 ? "Medium" : "Low";

  const claim = CLAIM_STYLES[result.claim_status] ?? CLAIM_STYLES.UNVERIFIED;

  const ipccWeight =
    result.ensemble_weight_kgml !== null ? Math.round((1 - result.ensemble_weight_kgml) * 100) : 100;
  const kgmlWeight =
    result.ensemble_weight_kgml !== null ? Math.round(result.ensemble_weight_kgml * 100) : 0;

  // Pipeline step completion logic
  const pipelineSteps = [
    { label: "IPCC Baseline", done: true },
    { label: "GEE Data", done: result.satellite_verified || result.kgml_enabled },
    { label: "KGML Model", done: result.kgml_enabled },
    { label: "Satellite", done: result.satellite_verified },
    { label: "Ensemble", done: result.ensemble_weight_kgml !== null },
  ];

  return (
    <div className="space-y-5">
      {/* ---- Claim Status Badge ---- */}
      <div
        className={`rounded-xl border-2 ${claim.border} ${claim.bg} backdrop-blur-sm p-4 text-center`}
      >
        <div className="flex items-center justify-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${claim.dot}`} />
          <span className={`text-lg font-bold tracking-wide ${claim.text}`}>
            {result.claim_status}
          </span>
        </div>
        {result.claim_status_reason && (
          <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {result.claim_status_reason}
          </p>
        )}
      </div>

      {/* ---- Main CO2 Estimate ---- */}
      <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/30 backdrop-blur-sm p-5 text-center space-y-1">
        <div className="text-4xl font-bold text-carbon-400">
          {formatTonnes(result.tonnes_co2_net)}
        </div>
        <div className="text-gray-400 text-sm">Net carbon sequestered per year</div>
        <div className="text-xs text-gray-500">
          Range: {formatTonnes(result.tonnes_co2_min)} &ndash; {formatTonnes(result.tonnes_co2_max)}{" "}
          (&plusmn;{result.uncertainty_pct}%)
        </div>
      </div>

      {/* ---- 5-Step Pipeline Visualization ---- */}
      <div className="rounded-xl border border-white/5 bg-forest-light/50 backdrop-blur-sm p-4">
        <div className="text-xs text-gray-400 mb-3 font-medium tracking-wide uppercase">
          MRV Pipeline
        </div>
        <div className="flex items-center gap-0">
          {pipelineSteps.map((step, i) => (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    step.done
                      ? "border-carbon-500 bg-carbon-500/20 text-carbon-300"
                      : "border-white/10 bg-forest-dark text-gray-600"
                  }`}
                >
                  {step.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                  )}
                </div>
                <span
                  className={`text-[10px] leading-tight text-center ${
                    step.done ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < pipelineSteps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded-full ${
                    step.done && pipelineSteps[i + 1].done
                      ? "bg-carbon-500/60"
                      : "bg-white/5"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Tier + Methodology Row ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-forest-light border border-white/5 p-3">
          <div className="text-gray-400 text-xs mb-1">Tier</div>
          <div className="text-white text-sm font-semibold">{result.tier}</div>
        </div>
        <div className="rounded-lg bg-forest-light border border-white/5 p-3">
          <div className="text-gray-400 text-xs mb-1">Methodology</div>
          <div className="text-white text-xs font-medium leading-tight">{result.methodology}</div>
        </div>
      </div>

      {/* ---- KGML Section (only when enabled) ---- */}
      {result.kgml_enabled && (
        <div className="rounded-xl border border-carbon-700/40 bg-carbon-900/20 backdrop-blur-sm p-4 space-y-4">
          <div className="text-xs text-carbon-400 font-semibold tracking-wide uppercase">
            KGML Model Output
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* KGML delta SOC */}
            <div className="rounded-lg bg-forest-light/70 p-3">
              <div className="text-gray-400 text-xs mb-0.5">KGML Delta SOC</div>
              <div className="text-white font-bold text-lg">
                {result.kgml_delta_soc !== null ? `${result.kgml_delta_soc.toFixed(3)} t/ha/yr` : "N/A"}
              </div>
            </div>
            {/* KGML CO2 net */}
            <div className="rounded-lg bg-forest-light/70 p-3">
              <div className="text-gray-400 text-xs mb-0.5">KGML CO2 Net</div>
              <div className="text-carbon-300 font-bold text-lg">
                {result.kgml_co2_net !== null ? formatTonnes(result.kgml_co2_net) : "N/A"}
              </div>
            </div>
          </div>

          {/* KGML Confidence Bar */}
          {result.kgml_confidence !== null && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">KGML Confidence</span>
                <span className="text-carbon-300 font-medium">
                  {result.kgml_confidence.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-carbon-500 transition-all"
                  style={{ width: `${Math.min(result.kgml_confidence, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Ensemble Weight Bar */}
          {result.ensemble_weight_kgml !== null && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5">Ensemble Weight</div>
              <div className="flex h-6 rounded-lg overflow-hidden border border-white/10">
                <div
                  className="bg-blue-600/40 flex items-center justify-center text-[10px] font-semibold text-blue-300 transition-all"
                  style={{ width: `${ipccWeight}%` }}
                >
                  {ipccWeight}% IPCC
                </div>
                <div
                  className="bg-carbon-600/40 flex items-center justify-center text-[10px] font-semibold text-carbon-300 transition-all"
                  style={{ width: `${kgmlWeight}%` }}
                >
                  {kgmlWeight}% KGML
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Value Breakdown ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-base font-bold text-white">
            {formatUSD(result.value_usd_min)} &ndash; {formatUSD(result.value_usd_max)}
          </div>
          <div className="text-xs text-gray-400">USD value range</div>
        </div>
        <div className="rounded-lg bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-base font-bold text-yellow-400">{formatLKR(avgLKR)}</div>
          <div className="text-xs text-gray-400">LKR estimated average</div>
        </div>
        <div className="rounded-lg bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-base font-bold text-carbon-300">{formatUSD(avgUSD)}</div>
          <div className="text-xs text-gray-400">USD estimated average</div>
        </div>
      </div>

      {/* ---- Confidence ---- */}
      <div className="rounded-lg bg-forest-light border border-white/5 p-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">AI Confidence</span>
          <span className="text-carbon-300 font-medium">{confidenceLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-carbon-500 transition-all"
              style={{ width: `${result.confidence_score}%` }}
            />
          </div>
          <span className="text-carbon-400 font-semibold text-sm">{result.confidence_score}%</span>
        </div>
      </div>

      {/* ---- Satellite Verification Status ---- */}
      {result.satellite_verified && (
        <div
          className={`rounded-lg border p-3 flex items-center gap-3 ${
            result.anomaly_flag
              ? "border-red-500/50 bg-red-900/20"
              : "border-carbon-600/50 bg-carbon-900/20"
          }`}
        >
          {result.anomaly_flag ? (
            <>
              <span className="text-red-400 text-lg">&#9888;</span>
              <div>
                <div className="text-red-300 text-sm font-medium">Anomaly Flagged</div>
                <div className="text-gray-400 text-xs">
                  Self-reported data exceeds satellite estimate by &gt;10%. Manual review triggered.
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="text-carbon-400 text-lg">&#10003;</span>
              <div>
                <div className="text-carbon-300 text-sm font-medium">Satellite Verified</div>
                <div className="text-gray-400 text-xs">
                  Sentinel-2 NDVI score: {result.satellite_ndvi_score?.toFixed(2)} &mdash; consistent
                  with reported sequestration
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- Collapsible SOC Details ---- */}
      <div className="rounded-lg border border-white/5 bg-forest-light/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setSocOpen(!socOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <span className="font-medium">SOC Details</span>
          <svg
            className={`w-4 h-4 transition-transform ${socOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {socOpen && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm border-t border-white/5 pt-3">
            <div>
              <div className="text-gray-500 text-xs">SOC Reference</div>
              <div className="text-white font-medium">{result.soc_ref_value.toFixed(2)} t C/ha</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Delta SOC Annual</div>
              <div className="text-white font-medium">
                {result.delta_soc_annual.toFixed(4)} t C/ha/yr
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Climate Zone</div>
              <div className="text-white font-medium">{result.climate_zone}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Soil Type</div>
              <div className="text-white font-medium">{result.soil_type}</div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Action Buttons ---- */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!result.satellite_verified && (
          <button
            onClick={onVerifySatellite}
            disabled={verifying}
            className="flex-1 py-2.5 rounded-lg border border-blue-600 hover:bg-blue-900/30 disabled:opacity-50 text-blue-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <span>&#128752;</span> Verify with Satellite
              </>
            )}
          </button>
        )}
        <button
          onClick={onAddToPool}
          className="flex-1 py-2.5 rounded-lg bg-carbon-600 hover:bg-carbon-500 text-white text-sm font-semibold transition-colors"
        >
          Continue to Pool
        </button>
      </div>
    </div>
  );
}
