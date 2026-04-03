import { ethers } from "ethers";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID ?? "80002");

// Minimal ABI -- only the functions used in the frontend
const ABI = [
  "function mint(address farmer, uint256 tonnes, string farmId, string vintage, bytes32 satHash) external returns (uint256)",
  "function retire(uint256 tokenId, uint256 amount) external",
  "function getCredit(uint256 tokenId) external view returns (tuple(address farmer, uint256 tonnes, string farmId, string vintage, string methodology, bytes32 satHash, bool retired, address retiredBy, uint256 retiredAt))",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function isRetired(uint256 tokenId) external view returns (bool)",
  "function totalMinted() external view returns (uint256)",
  "event CreditMinted(uint256 indexed tokenId, address indexed farmer, uint256 tonnes, string farmId, string vintage, bytes32 satHash)",
  "event CreditRetired(uint256 indexed tokenId, address indexed retiredBy, uint256 tonnes, string farmId, uint256 timestamp)",
];

export { CHAIN_ID };

export async function getProvider(): Promise<ethers.BrowserProvider> {
  if (!window.ethereum)
    throw new Error("MetaMask not found. Please install MetaMask.");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function connectWallet(): Promise<string> {
  const provider = await getProvider();
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

/** Switch to Polygon Amoy Testnet (chain ID 80002) */
export async function switchToAmoy(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found.");
  const chainIdHex = "0x" + CHAIN_ID.toString(16);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err: unknown) {
    // Chain not added -- add it
    if ((err as { code: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: "Polygon Amoy Testnet",
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
            rpcUrls: ["https://rpc-amoy.polygon.technology"],
            blockExplorerUrls: ["https://amoy.polygonscan.com"],
          },
        ],
      });
    }
  }
}

export function getContract(
  signerOrProvider: ethers.Signer | ethers.Provider
) {
  if (!CONTRACT_ADDRESS)
    throw new Error("Contract address not configured in .env");
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
}

export async function retireCredit(
  tokenId: number,
  amount: number
): Promise<ethers.TransactionReceipt | null> {
  const signer = await getSigner();
  const contract = getContract(signer);
  const tx = await contract.retire(tokenId, amount);
  return tx.wait();
}

export async function getCreditOnChainDirect(tokenId: number) {
  const provider = await getProvider();
  const contract = getContract(provider);
  return contract.getCredit(tokenId);
}

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void
      ) => void;
    };
  }
}
