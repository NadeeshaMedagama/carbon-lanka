import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, FileUp, FileCheck } from "lucide-react";
import type { FarmInput } from "../../types";
import { CROP_LABELS, PRACTICE_LABELS } from "../../utils/formatters";
import { api } from "../../services/api";

// Fix Leaflet's broken default icon paths when bundled with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom emerald pin icon
const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;
    background:#10b981;
    border:3px solid #fff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

interface Props {
  onCalculate: (farm: FarmInput, proofFile?: File) => void;
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
  "Ampara","Anuradhapura","Badulla","Batticaloa","Colombo","Galle","Gampaha",
  "Hambantota","Jaffna","Kalutara","Kandy","Kegalle","Kilinochchi","Kurunegala",
  "Mannar","Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya",
  "Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya",
];

// Sri Lanka bounds for clamping
const SL_BOUNDS = { minLat: 5.9, maxLat: 9.9, minLng: 79.5, maxLng: 81.9 };

/** Invisible component that captures map clicks */
function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(
        parseFloat(e.latlng.lat.toFixed(4)),
        parseFloat(e.latlng.lng.toFixed(4)),
      );
    },
  });
  return null;
}

/** Marker that keeps the map view synced when lat/lng change via the inputs */
function SyncedMarker({
  lat,
  lng,
  onDrag,
}: {
  lat: number;
  lng: number;
  onDrag: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Pan map to new position when coordinates change from the inputs
  const map = useMapEvents({});
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }
  }, [lat, lng, map]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={PIN_ICON}
      draggable
      eventHandlers={{
        dragend(e) {
          const m = e.target as L.Marker;
          const pos = m.getLatLng();
          onDrag(
            parseFloat(pos.lat.toFixed(4)),
            parseFloat(pos.lng.toFixed(4)),
          );
        },
      }}
    />
  );
}

export function FarmForm({ onCalculate, loading }: Props) {
  const [cropOptions, setCropOptions] = useState<{ key: string; label: string }[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [form, setForm] = useState<FarmInput>({
    land_area_ha: 2.02,
    crop_type: "tea_organic",
    practice_change: "organic_conversion",
    years_since_change: 3,
    fertiliser_kg_ha_yr: 0,
    fuel_litres_yr: 0,
    farmer_name: "",
    district: "Nuwara Eliya",
    latitude: 6.9271,
    longitude: 80.7718,
  });

  useEffect(() => {
    api
      .getCropTypes()
      .then((rows) => {
        const options = rows
          .map((row) => ({ key: row.key, label: row.label || row.key }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCropOptions(options);
        if (options.length > 0 && !options.some((o) => o.key === form.crop_type)) {
          const nextCrop = options[0].key;
          const practices = PRACTICE_BY_CROP[nextCrop] ?? ["conventional_management"];
          setForm((prev) => ({ ...prev, crop_type: nextCrop, practice_change: practices[0] }));
        }
      })
      .catch(() => setCropOptions([]));
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

  const handlePick = (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleLatInput = (v: number) => {
    const clamped = Math.min(SL_BOUNDS.maxLat, Math.max(SL_BOUNDS.minLat, v));
    setForm((prev) => ({ ...prev, latitude: clamped }));
  };

  const handleLngInput = (v: number) => {
    const clamped = Math.min(SL_BOUNDS.maxLng, Math.max(SL_BOUNDS.minLng, v));
    setForm((prev) => ({ ...prev, longitude: clamped }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(form, proofFile ?? undefined);
  };

  const acresEquiv = (form.land_area_ha / 0.404686).toFixed(1);
  const lat = form.latitude ?? 6.9271;
  const lng = form.longitude ?? 80.7718;

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
      </div>

      {/* ── Location picker ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-carbon-400" />
            Farm Location
          </label>
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-carbon-700/50 bg-carbon-900/20 text-carbon-400 hover:bg-carbon-900/40 transition-colors"
          >
            <Navigation className="w-3 h-3" />
            {mapOpen ? "Close map" : "Pick on map"}
          </button>
        </div>

        {/* Lat / Lng number inputs — always visible */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
            <input
              type="number"
              min={SL_BOUNDS.minLat}
              max={SL_BOUNDS.maxLat}
              step={0.0001}
              value={lat}
              onChange={(e) => handleLatInput(parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-carbon-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
            <input
              type="number"
              min={SL_BOUNDS.minLng}
              max={SL_BOUNDS.maxLng}
              step={0.0001}
              value={lng}
              onChange={(e) => handleLngInput(parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-forest-light border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-carbon-500"
            />
          </div>
        </div>

        {/* Interactive map — shown when open */}
        {mapOpen && (
          <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ height: 320 }}>
            <MapContainer
              center={[lat, lng]}
              zoom={9}
              style={{ width: "100%", height: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapClickHandler onPick={handlePick} />
              <SyncedMarker lat={lat} lng={lng} onDrag={handlePick} />
            </MapContainer>

            {/* Map hint bar */}
            <div className="px-3 py-1.5 bg-forest-mid border-t border-white/5 text-xs text-gray-500 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-carbon-500" />
              Click anywhere on the map or drag the pin to set your farm location
            </div>
          </div>
        )}
      </div>

      {/* ── Rest of the form ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {(PRACTICE_BY_CROP[form.crop_type] ?? ["conventional_management"]).map((p) => (
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

      {/* Land ownership proof */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Land Ownership Proof <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Upload deed, title certificate, or government land permit (PDF, JPG, PNG).
          Required for admin verification before credits can be issued.
        </p>
        <label
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            proofFile
              ? "border-carbon-600/50 bg-carbon-900/20"
              : "border-white/10 bg-forest-light hover:border-carbon-700/40"
          }`}
        >
          {proofFile ? (
            <FileCheck className="w-5 h-5 text-carbon-400 shrink-0" />
          ) : (
            <FileUp className="w-5 h-5 text-gray-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            {proofFile ? (
              <div className="text-sm text-carbon-300 font-medium truncate">{proofFile.name}</div>
            ) : (
              <div className="text-sm text-gray-500">Click to select file</div>
            )}
            <div className="text-xs text-gray-600">
              {proofFile
                ? `${(proofFile.size / 1024).toFixed(0)} KB`
                : "PDF, JPG, PNG — Max 10 MB"}
            </div>
          </div>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size <= 10 * 1024 * 1024) setProofFile(f);
            }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || !proofFile}
        className="w-full py-3 rounded-xl bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analysing...
          </>
        ) : (
          "Run KGML Carbon Analysis"
        )}
      </button>
    </form>
  );
}
