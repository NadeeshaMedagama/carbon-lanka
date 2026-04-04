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
    if (connecting) return; // already in progress — don't stack requests
    setConnecting(true);
    setError(null);
    try {
      await switchToAmoy();
      const addr = await connectWallet();
      setAccount(addr);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === -32002) {
        // MetaMask popup is already open — just tell the user
        setError("MetaMask is already asking for permission. Please open MetaMask and approve the request.");
      } else if (code === 4001) {
        setError("Connection rejected. Please approve in MetaMask.");
      } else {
        setError((err as Error).message ?? "Connection failed");
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = () => setAccount(null);

  const shortAccount = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return { account, shortAccount, connecting, error, connect, disconnect };
}
