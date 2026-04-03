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
  satellite_verified: boolean;
  satellite_ndvi_score?: number;
  anomaly_flag: boolean;
  calculated_at: string;
}

export interface FarmRecord {
  id: number;
  farmer_name: string;
  district: string;
  land_area_ha: number;
  crop_type: string;
  estimated_tonnes_co2?: number;
  in_pool: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
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
