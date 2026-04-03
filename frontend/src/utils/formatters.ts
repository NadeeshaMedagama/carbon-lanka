export const formatUSD = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export const formatLKR = (amount: number): string =>
  new Intl.NumberFormat("si-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount);

export const formatTonnes = (t: number): string =>
  `${t.toLocaleString("en-US", { maximumFractionDigits: 1 })} t CO₂`;

export const formatPct = (p: number): string => `${p.toFixed(1)}%`;

export const shortHash = (hash: string): string =>
  hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;

export const CROP_LABELS: Record<string, string> = {
  tea_organic: "Organic Tea",
  tea_conventional: "Conventional Tea",
  paddy_rice: "Paddy Rice",
  rubber_agroforestry: "Rubber Agroforestry",
  spice_cinnamon: "Cinnamon / Spice",
  solar_cooperative: "Solar Co-operative",
  forest_regen: "Forest Regeneration",
  coconut_organic: "Organic Coconut",
};

export const PRACTICE_LABELS: Record<string, string> = {
  organic_conversion: "Organic Conversion",
  agroforestry_adoption: "Agroforestry Adoption",
  solar_install: "Solar Installation",
  forest_regen: "Forest Regeneration",
  improved_water_management: "Improved Water Management",
  conventional_management: "Conventional Management",
};
