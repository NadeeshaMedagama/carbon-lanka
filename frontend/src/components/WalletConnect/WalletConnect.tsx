import { useWeb3 } from "../../hooks/useWeb3";

export function WalletConnect() {
  const { account, shortAccount, connecting, error, connect, disconnect } = useWeb3();

  return (
    <div className="flex items-center gap-2">
      {account ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-carbon-900/40 border border-carbon-700/60 text-carbon-300 text-sm font-mono">
            <span className="w-2 h-2 rounded-full bg-carbon-500 animate-pulse" />
            {shortAccount}
          </span>
          <button
            onClick={disconnect}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {connecting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      )}
      {error && <p className="text-red-400 text-xs max-w-48 truncate" title={error}>{error}</p>}
    </div>
  );
}
