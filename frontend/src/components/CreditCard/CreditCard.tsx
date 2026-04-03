import type { CreditListing } from "../../types";
import { formatUSD, formatLKR, formatTonnes, shortHash } from "../../utils/formatters";

interface Props {
  credit: CreditListing;
  onBuy: (credit: CreditListing) => void;
  buying: boolean;
}

export function CreditCard({ credit, onBuy, buying }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-forest-light hover:border-carbon-600/50 transition-colors p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-white font-semibold text-sm leading-tight">
            Sri Lanka Carbon Credit
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            {credit.farmer_name} · {credit.district}
          </div>
          <div className="text-gray-500 text-[11px] mt-0.5">{credit.methodology}</div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-carbon-900/50 border border-carbon-700/50 text-carbon-400 text-xs font-medium whitespace-nowrap">
          {credit.vintage}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-forest-dark/50 p-2">
          <div className="text-gray-400 text-xs">Volume</div>
          <div className="text-white font-bold">{formatTonnes(credit.tonnes_co2)}</div>
        </div>
        <div className="rounded-lg bg-forest-dark/50 p-2">
          <div className="text-gray-400 text-xs">Price / tonne</div>
          <div className="text-white font-bold">{formatUSD(credit.price_per_tonne_usd)}</div>
        </div>
      </div>

      {/* Total price */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">{formatUSD(credit.price_usd)}</div>
          <div className="text-yellow-400 text-xs">{formatLKR(credit.price_lkr)}</div>
        </div>
        <button
          onClick={() => onBuy(credit)}
          disabled={buying}
          className="px-4 py-2 rounded-lg bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
        >
          {buying ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Buying…</>
          ) : (
            "Buy Credit"
          )}
        </button>
      </div>

      {/* Token info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-white/5 pt-2">
        <span className="px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400">Token #{credit.token_id}</span>
        <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">ERC-1155</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">Polygon</span>
        <a
          href={credit.block_explorer_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-mono hover:text-gray-300 transition-colors"
        >
          {shortHash(credit.tx_hash)}
        </a>
      </div>
    </div>
  );
}
