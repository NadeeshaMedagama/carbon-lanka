import axios from "axios";
import type {
  FarmInput,
  MRVResult,
  FarmRecord,
  PoolBundle,
  CreditListing,
  PayoutDisplay,
  NDVITile,
  CreditTokenRecord,
  KGMLStatus,
  BlockchainHealth,
  AdminStats,
  AdminCreditRecord,
} from "../types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const client = axios.create({ baseURL: BASE });

export const api = {
  // ── MRV ──────────────────────────────────────────────────────────────
  calculateMRV: (farm: FarmInput) =>
    client.post<MRVResult>("/mrv/calculate", farm).then((r) => r.data),

  /** Primary calculation: IPCC + GEE + KGML ensemble (5-step pipeline) */
  calculateKGML: (farm: FarmInput, lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set("latitude", String(lat));
    if (lng !== undefined) params.set("longitude", String(lng));
    return client
      .post<MRVResult>(`/mrv/calculate-kgml?${params}`, farm)
      .then((r) => r.data);
  },

  verifySatellite: (farm: FarmInput, lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set("latitude", String(lat));
    if (lng !== undefined) params.set("longitude", String(lng));
    return client
      .post<MRVResult>(`/mrv/verify-satellite?${params}`, farm)
      .then((r) => r.data);
  },

  getNDVITile: (cropType: string, lat = 6.9271, lng = 80.7718) =>
    client
      .get<NDVITile>(
        `/mrv/ndvi-tile?crop_type=${cropType}&latitude=${lat}&longitude=${lng}`
      )
      .then((r) => r.data),

  getCropTypes: () =>
    client
      .get<{ key: string; label: string; description: string }[]>(
        "/mrv/crop-types"
      )
      .then((r) => r.data),

  /** Check KGML model + GEE connection health */
  getKGMLStatus: () =>
    client.get<KGMLStatus>("/mrv/kgml-status").then((r) => r.data),

  // ── Farms ────────────────────────────────────────────────────────────
  registerFarm: (farm: FarmInput) =>
    client.post<FarmRecord>("/farms", farm).then((r) => r.data),

  listFarms: (inPool?: boolean) => {
    const params = inPool !== undefined ? `?in_pool=${inPool}` : "";
    return client.get<FarmRecord[]>(`/farms${params}`).then((r) => r.data);
  },

  getFarm: (id: number) =>
    client.get<FarmRecord>(`/farms/${id}`).then((r) => r.data),

  joinPool: (farmId: number) =>
    client.post<FarmRecord>(`/farms/${farmId}/join-pool`).then((r) => r.data),

  uploadLandProof: (farmId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return client
      .post<{ success: boolean; farm_id: number; land_proof_url: string }>(
        `/farms/${farmId}/upload-proof`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      .then((r) => r.data);
  },

  // ── Credits ──────────────────────────────────────────────────────────
  getPool: () =>
    client.get<PoolBundle>("/credits/pool").then((r) => r.data),

  mintCredit: (farmId: number, farmerAddress?: string) =>
    client
      .post<{
        token_id: number;
        tx_hash: string;
        block_explorer_url: string;
        on_chain: boolean;
      }>(
        `/credits/mint?farm_id=${farmId}${farmerAddress ? `&farmer_address=${farmerAddress}` : ""}`
      )
      .then((r) => r.data),

  listCredits: (retired = false) =>
    client
      .get<CreditTokenRecord[]>(`/credits?retired=${retired}`)
      .then((r) => r.data),

  /** Read credit metadata directly from deployed smart contract */
  getCreditOnChain: (tokenId: number) =>
    client
      .get<Record<string, unknown>>(`/credits/${tokenId}/on-chain`)
      .then((r) => r.data),

  /** Check blockchain connectivity and verifier wallet status */
  getBlockchainHealth: () =>
    client
      .get<BlockchainHealth>("/credits/blockchain/health")
      .then((r) => r.data),

  /** Convenience alias: list only retired credits */
  listRetiredCredits: () =>
    client
      .get<CreditTokenRecord[]>("/credits?retired=true")
      .then((r) => r.data),

  // ── Marketplace ──────────────────────────────────────────────────────
  getListings: () =>
    client.get<CreditListing[]>("/marketplace").then((r) => r.data),

  buyCredit: (tokenId: number, buyerAddress: string, priceUsd: number) =>
    client
      .post<PayoutDisplay>("/marketplace/buy", {
        token_id: tokenId,
        buyer_address: buyerAddress,
        price_usd: priceUsd,
      })
      .then((r) => r.data),

  getTransactions: () =>
    client.get<Record<string, unknown>[]>("/marketplace/transactions").then((r) => r.data),

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminStats: (key: string) =>
    client.get<AdminStats>("/admin/stats", { headers: { "x-admin-key": key } }).then((r) => r.data),

  adminGetFlaggedFarms: (key: string) =>
    client.get<FarmRecord[]>("/admin/farms/flagged", { headers: { "x-admin-key": key } }).then((r) => r.data),

  adminGetAllFarms: (key: string) =>
    client.get<FarmRecord[]>("/admin/farms", { headers: { "x-admin-key": key } }).then((r) => r.data),

  adminApproveFarm: (key: string, farmId: number, note?: string) =>
    client
      .post<{ success: boolean; claim_status: string }>(
        `/admin/farms/${farmId}/approve`,
        { note: note ?? "Manually approved by admin" },
        { headers: { "x-admin-key": key } },
      )
      .then((r) => r.data),

  adminRejectFarm: (key: string, farmId: number, reason?: string) =>
    client
      .post<{ success: boolean; claim_status: string }>(
        `/admin/farms/${farmId}/reject`,
        { reason: reason ?? "Manually rejected by admin" },
        { headers: { "x-admin-key": key } },
      )
      .then((r) => r.data),

  adminFlagFarm: (key: string, farmId: number, reason?: string) =>
    client
      .post<{ success: boolean }>(
        `/admin/farms/${farmId}/flag`,
        { reason: reason ?? "Manually flagged for review" },
        { headers: { "x-admin-key": key } },
      )
      .then((r) => r.data),

  adminDeleteFarm: (key: string, farmId: number) =>
    client
      .delete<{ success: boolean; deleted_tokens: number }>(
        `/admin/farms/${farmId}`,
        { headers: { "x-admin-key": key } },
      )
      .then((r) => r.data),

  adminGetAllCredits: (key: string) =>
    client.get<AdminCreditRecord[]>("/admin/credits", { headers: { "x-admin-key": key } }).then((r) => r.data),

  adminRetireCredit: (key: string, tokenId: number, reason?: string) =>
    client
      .post<{ success: boolean }>(
        `/admin/credits/${tokenId}/retire`,
        { reason: reason ?? "Administratively retired" },
        { headers: { "x-admin-key": key } },
      )
      .then((r) => r.data),
};
