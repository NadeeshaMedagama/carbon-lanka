import { useState, useEffect, useCallback } from "react";
import { connectWallet, switchToAmoy } from "../services/blockchain";

export function useWeb3() {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ethereum) return;
    // Auto-detect already connected account
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0) setAccount(list[0]);
      })
      .catch(() => {});

    const handleAccountChange = (accounts: unknown) => {
      const list = accounts as string[];
      setAccount(list.length > 0 ? list[0] : null);
    };

    window.ethereum.on("accountsChanged", handleAccountChange);
    return () =>
      window.ethereum?.removeListener("accountsChanged", handleAccountChange);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await switchToAmoy();
      const addr = await connectWallet();
      setAccount(addr);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = () => setAccount(null);

  const shortAccount = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return { account, shortAccount, connecting, error, connect, disconnect };
}
