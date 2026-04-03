import type { MRVResult } from "../../types";
import { formatUSD, formatLKR, formatTonnes } from "../../utils/formatters";

interface Props {
  result: MRVResult;
  onVerifySatellite: () => void;
  onAddToPool: () => void;
  verifying: boolean;
}

export function CarbonEstimate({ result, onVerifySatellite, onAddToPool, verifying }: Props) {
  const avgUSD = (result.value_usd_min + result.value_usd_max) / 2;
  const avgLKR = (result.value_lkr_min + result.value_lkr_max) / 2;

  return (
    <div className="space-y-5">
      {/* Main estimate card */}
      <div className="rounded-xl border border-carbon-700/50 bg-carbon-900/30 p-5">
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-carbon-400">
            {formatTonnes(result.tonnes_co2_net)}
          </div>
          <div className="text-gray-400 text-sm mt-1">
            Net carbon sequestered per year
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Range: {formatTonnes(result.tonnes_co2_min)} – {formatTonnes(result.tonnes_co2_max)} (±{result.uncertainty_pct}%)
          </div>
        </div>

        {/* Value breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-forest-light p-3 text-center">
            <div className="text-xl font-bold text-white">
              {formatUSD(result.value_usd_min)} – {formatUSD(result.value_usd_max)}
            </div>
            <div className="text-xs text-gray-400">USD / year</div>
          </div>
          <div className="rounded-lg bg-forest-light p-3 text-center">
            <div className="text-xl font-bold text-yellow-400">
              {formatLKR(avgLKR)}
            </div>
            <div className="text-xs text-gray-400">LKR / year (avg)</div>
          </div>
        </div>
      </div>

      {/* Confidence + methodology */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-forest-light border border-white/5 p-3">
          <div className="text-gray-400 text-xs mb-1">AI Confidence</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-carbon-500 transition-all"
                style={{ width: `${result.confidence_score}%` }}
              />
            </div>
            <span className="text-carbon-400 font-semibold">{result.confidence_score}%</span>
          </div>
        </div>
        <div className="rounded-lg bg-forest-light border border-white/5 p-3">
          <div className="text-gray-400 text-xs mb-1">Methodology</div>
          <div className="text-white text-xs font-medium leading-tight">{result.methodology}</div>
        </div>
      </div>

      {/* Satellite verification status */}
      {result.satellite_verified && (
        <div className={`rounded-lg border p-3 flex items-center gap-3 ${result.anomaly_flag ? "border-red-500/50 bg-red-900/20" : "border-carbon-600/50 bg-carbon-900/20"}`}>
          {result.anomaly_flag ? (
            <>
              <span className="text-red-400 text-lg">⚠</span>
              <div>
                <div className="text-red-300 text-sm font-medium">Anomaly Flagged</div>
                <div className="text-gray-400 text-xs">Self-reported data exceeds satellite estimate by &gt;10%. Manual review triggered.</div>
              </div>
            </>
          ) : (
            <>
              <span className="text-carbon-400 text-lg">✓</span>
              <div>
                <div className="text-carbon-300 text-sm font-medium">Satellite Verified</div>
                <div className="text-gray-400 text-xs">Sentinel-2 NDVI score: {result.satellite_ndvi_score?.toFixed(2)} — consistent with reported sequestration</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!result.satellite_verified && (
          <button
            onClick={onVerifySatellite}
            disabled={verifying}
            className="flex-1 py-2.5 rounded-lg border border-blue-600 hover:bg-blue-900/30 disabled:opacity-50 text-blue-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {verifying ? (
              <><span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />Verifying…</>
            ) : (
              <><span>🛰</span> Verify with Satellite</>
            )}
          </button>
        )}
        <button
          onClick={onAddToPool}
          className="flex-1 py-2.5 rounded-lg bg-carbon-600 hover:bg-carbon-500 text-white text-sm font-semibold transition-colors"
        >
          Add to Pool &rarr;
        </button>
      </div>
    </div>
  );
}
