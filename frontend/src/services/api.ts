import axios from "axios";
import type { FarmInput, MRVResult, FarmRecord, PoolBundle, CreditListing, PayoutDisplay, NDVITile, CreditTokenRecord } from "../types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const client = axios.create({ baseURL: BASE });

export const api = {
  // MRV
  calculateMRV: (farm: FarmInput) =>
    client.post<MRVResult>("/mrv/calculate", farm).then((r) => r.data),

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
      .get<NDVITile>(`/mrv/ndvi-tile?crop_type=${cropType}&latitude=${lat}&longitude=${lng}`)
      .then((r) => r.data),

  getCropTypes: () =>
    client.get<{ key: string; label: string; description: string }[]>("/mrv/crop-types").then((r) => r.data),

  // Farms
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

  // Credits
  getPool: () =>
    client.get<PoolBundle>("/credits/pool").then((r) => r.data),

  mintCredit: (farmId: number, farmerAddress?: string) =>
    client
      .post<{ token_id: number; tx_hash: string; block_explorer_url: string }>(
        `/credits/mint?farm_id=${farmId}${farmerAddress ? `&farmer_address=${farmerAddress}` : ""}`
      )
      .then((r) => r.data),

  listCredits: (retired = false) =>
    client
      .get<CreditTokenRecord[]>(`/credits?retired=${retired}`)
      .then((r) => r.data),

  // Marketplace
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
};
