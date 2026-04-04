export interface FarmInput {
  land_area_ha: number;
  crop_type: string;
  practice_change: string;
  years_since_change: number;
  fertiliser_kg_ha_yr?: number;
  fuel_litres_yr?: number;
  solar_kw_installed?: number;
  farmer_name?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  // Passed by the client from KGML analysis result when registering
  claim_status?: string;
  claim_status_reason?: string | null;
  anomaly_flag?: boolean;
}

export interface MRVResult {
  farm_id?: number;
  crop_type: string;
  land_area_ha: number;
  tonnes_co2_net: number;
  tonnes_co2_min: number;
  tonnes_co2_max: number;
  uncertainty_pct: number;
  confidence_score: number;
  value_usd_min: number;
  value_usd_max: number;
  value_lkr_min: number;
  value_lkr_max: number;
  methodology: string;
  // IPCC SOC calculation details
  tier: string;                           // "Tier-1" | "Tier-2" | "Tier-2+Satellite"
  soc_ref_value: number;
  delta_soc_annual: number;
  climate_zone: string;
  soil_type: string;
  // KGML model results (Liu et al. 2024)
  kgml_delta_soc: number | null;
  kgml_co2_net: number | null;
  kgml_confidence: number | null;
  kgml_enabled: boolean;
  ensemble_weight_kgml: number | null;
  // Satellite verification
  satellite_verified: boolean;
  satellite_ndvi_score?: number;
  anomaly_flag: boolean;
  // Claim validity
  claim_status: string;                   // "VERIFIED" | "UNVERIFIED" | "SUSPICIOUS" | "REJECTED"
  claim_status_reason: string | null;
  calculated_at: string;
}

export interface FarmRecord {
  id: number;
  farmer_name: string;
  district: string;
  land_area_ha: number;
  crop_type: string;
  practice_change: string;
  years_since_change: number;
  estimated_tonnes_co2?: number;
  in_pool: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  claim_status: string;
  claim_status_reason?: string | null;
  anomaly_flag: boolean;
  land_proof_url?: string | null;
  admin_approved: boolean;
}

export interface AdminStats {
  total_farms: number;
  total_credits: number;
  flagged_count: number;
  retired_credits: number;
  on_chain_credits: number;
  total_tonnes_co2: number;
  pooled_farms: number;
  claim_status_counts: {
    VERIFIED: number;
    UNVERIFIED: number;
    SUSPICIOUS: number;
    REJECTED: number;
  };
}

export interface AdminCreditRecord extends CreditTokenRecord {
  farmer_name: string;
  district: string;
  crop_type: string;
  farm_claim_status: string;
}

export interface PoolMember {
  farm_id: number;
  farmer_name: string;
  district: string;
  crop_type: string;
  tonnes_co2: number;
  share_pct: number;
  payout_usd: number;
  payout_lkr: number;
  latitude?: number;
  longitude?: number;
}

export interface PoolBundle {
  total_farms: number;
  total_tonnes_co2: number;
  gross_value_usd: number;
  platform_fee_usd: number;
  shared_mrv_cost_usd: number;
  net_to_farmers_usd: number;
  net_to_farmers_lkr: number;
  meets_verra_minimum: boolean;
  verra_minimum_tonnes: number;
  pool_members: PoolMember[];
}

export interface CreditListing {
  token_id: number;
  farm_id: number;
  farmer_name: string;
  district: string;
  crop_type: string;
  tonnes_co2: number;
  vintage: string;
  methodology: string;
  price_usd: number;
  price_per_tonne_usd: number;
  price_lkr: number;
  tx_hash: string;
  block_explorer_url: string;
  on_chain: boolean;
}

export interface CreditTokenRecord {
  id: number;
  token_id: number;
  farm_id: number;
  farmer_address: string;
  tonnes_co2: number;
  vintage: string;
  methodology: string;
  sat_hash: string;
  tx_hash: string;
  retired: boolean;
  retired_by?: string | null;
  minted_at: string;
  retired_at?: string | null;
  on_chain: boolean;
}

export interface PayoutDisplay {
  token_id: number;
  farmer_name: string;
  tonnes_co2: number;
  gross_usd: number;
  platform_fee_usd: number;
  mrv_cost_share_usd: number;
  net_usd: number;
  net_lkr: number;
  tx_hash: string;
  block_explorer_url: string;
}

export interface NDVITile {
  ndvi_score: number;
  ndvi_trend?: string;
  gee_live?: boolean;
  center: { lat: number; lng: number };
  bbox: { south: number; west: number; north: number; east: number };
  color_scale: string;
  legend: {
    min: number;
    max: number;
    label: string;
    low: string;
    high: string;
  };
  source: string;
  date: string;
  note: string;
  tile_url?: string;
}

export interface KGMLStatus {
  kgml_model_loaded: boolean;
  gee_connected: boolean;
  model_info: Record<string, unknown>;
}

export interface BlockchainHealth {
  enabled: boolean;
  connected?: boolean;
  chain_id?: number;
  verifier_address?: string;
  verifier_balance_pol?: number;
  contract_address?: string;
  reason?: string;
}

export type CropType =
  | "tea_organic"
  | "tea_conventional"
  | "paddy_rice"
  | "rubber_agroforestry"
  | "spice_cinnamon"
  | "solar_cooperative"
  | "forest_regen"
  | "coconut_organic";
