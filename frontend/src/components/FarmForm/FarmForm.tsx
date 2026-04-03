import { useEffect, useMemo, useState } from "react";
import type { FarmInput } from "../../types";
import { CROP_LABELS, PRACTICE_LABELS } from "../../utils/formatters";
import { api } from "../../services/api";

interface Props {
  onCalculate: (farm: FarmInput) => void;
  loading: boolean;
}

const PRACTICE_BY_CROP: Record<string, string[]> = {
  tea_organic: ["organic_conversion"],
  tea_conventional: ["conventional_management"],
  paddy_rice: ["improved_water_management", "conventional_management"],
  rubber_agroforestry: ["agroforestry_adoption"],
  spice_cinnamon: ["organic_conversion", "conventional_management"],
  solar_cooperative: ["solar_install"],
  forest_regen: ["forest_regen"],
  coconut_organic: ["organic_conversion"],
};

const SRI_LANKA_DISTRICTS = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
];

export function FarmForm({ onCalculate, loading }: Props) {
  const [cropOptions, setCropOptions] = useState<{ key: string; label: string }[]>([]);
  const [form, setForm] = useState<FarmInput>({
    land_area_ha: 2.02,
    crop_type: "tea_organic",
    practice_change: "organic_conversion",
    years_since_change: 3,
    fertiliser_kg_ha_yr: 0,
    fuel_litres_yr: 0,
    farmer_name: "",
    district: "Nuwara Eliya",
  });

  useEffect(() => {
    api
      .getCropTypes()
      .then((rows) => {
        const options = rows
          .map((row) => ({ key: row.key, label: row.label || row.key }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCropOptions(options);

        // Keep form crop valid if backend list differs from static defaults.
        if (options.length > 0 && !options.some((o) => o.key === form.crop_type)) {
          const nextCrop = options[0].key;
          const practices = PRACTICE_BY_CROP[nextCrop] ?? ["conventional_management"];
          setForm((prev) => ({ ...prev, crop_type: nextCrop, practice_change: practices[0] }));
        }
      })
      .catch(() => {
        // Keep fallback static list when API is unavailable.
        setCropOptions([]);
      });
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCropOptions = useMemo(() => {
    if (cropOptions.length > 0) return cropOptions;
    return Object.entries(CROP_LABELS).map(([key, label]) => ({ key, label }));
  }, [cropOptions]);

  const set = (k: keyof FarmInput, v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleCropChange = (crop: string) => {
    const practices = PRACTICE_BY_CROP[crop] ?? ["conventional_management"];
    setForm((prev) => ({ ...prev, crop_type: crop, practice_change: practices[0] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(form);
  };

  // Convert acres to ha helper shown in UI
  const acresEquiv = (form.land_area_ha / 0.404686).toFixed(1);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Farmer name */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Farmer Name</label>
          <input
            type="text"
            value={form.farmer_name ?? ""}
            onChange={(e) => set("farmer_name", e.target.value)}
            placeholder="e.g. Priya Silva"
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-carbon-500"
          />
        </div>

        {/* District */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">District</label>
          <select
            value={form.district ?? "Nuwara Eliya"}
            onChange={(e) => set("district", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
          >
            {SRI_LANKA_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Land area */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Land Area (hectares)
            <span className="ml-1 text-gray-500 text-xs">≈ {acresEquiv} acres</span>
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={form.land_area_ha}
            onChange={(e) => set("land_area_ha", parseFloat(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
            required
          />
        </div>

        {/* Crop type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Crop Type</label>
          <select
            value={form.crop_type}
            onChange={(e) => handleCropChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
          >
            {availableCropOptions.map((crop) => (
              <option key={crop.key} value={crop.key}>{crop.label}</option>
            ))}
          </select>
        </div>

        {/* Practice change */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Practice Change</label>
          <select
            value={form.practice_change}
            onChange={(e) => set("practice_change", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
          >
            {(PRACTICE_BY_CROP[form.crop_type] ?? ["conventional_management"]).map(p => (
              <option key={p} value={p}>{PRACTICE_LABELS[p] ?? p}</option>
            ))}
          </select>
        </div>

        {/* Years since change */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Years Since Practice Change</label>
          <input
            type="number"
            min={1}
            max={30}
            value={form.years_since_change}
            onChange={(e) => set("years_since_change", parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
          />
        </div>

        {/* Solar capacity (only for solar) */}
        {form.crop_type === "solar_cooperative" && (
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Installed Solar Capacity (kW)</label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={form.solar_kw_installed ?? ""}
              onChange={(e) => set("solar_kw_installed", parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white focus:outline-none focus:border-carbon-500"
            />
          </div>
        )}
      </div>

      {/* Demo preset button */}
      <button
        type="button"
        onClick={() => setForm({
          land_area_ha: 5 * 0.404686,
          crop_type: "tea_organic",
          practice_change: "organic_conversion",
          years_since_change: 3,
          farmer_name: "Demo Farmer",
          district: "Nuwara Eliya",
          fertiliser_kg_ha_yr: 0,
          fuel_litres_yr: 0,
        })}
        className="text-xs text-carbon-500 hover:text-carbon-400 underline underline-offset-2"
      >
        Load demo: 5-acre tea farm (Nuwara Eliya)
      </button>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Calculating…
          </>
        ) : (
          "Calculate Carbon Estimate"
        )}
      </button>
    </form>
  );
}
