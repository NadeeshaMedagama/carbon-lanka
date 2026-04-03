import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { PoolMember } from "../../types";
import { formatTonnes, formatUSD, formatLKR, CROP_LABELS } from "../../utils/formatters";
import "leaflet/dist/leaflet.css";

interface Props {
  members: PoolMember[];
  totalTonnes: number;
  totalFarms: number;
  meetsMinimum: boolean;
  verraMinimumTonnes: number;
  totalMrvCostUsd: number;
}

function markerColor(crop: string): string {
  const colors: Record<string, string> = {
    tea_organic: "#22c55e",
    tea_conventional: "#86efac",
    rubber_agroforestry: "#a3e635",
    paddy_rice: "#fbbf24",
    spice_cinnamon: "#fb923c",
    solar_cooperative: "#facc15",
    forest_regen: "#4ade80",
    coconut_organic: "#34d399",
  };
  return colors[crop] ?? "#6b7280";
}

function markerRadius(tonnes: number): number {
  return Math.max(4, Math.min(14, Math.sqrt(tonnes) * 0.6));
}

export function PoolMap({
  members,
  totalTonnes,
  totalFarms,
  meetsMinimum,
  verraMinimumTonnes,
  totalMrvCostUsd,
}: Props) {
  const withCoords = members.filter((m) => m.latitude && m.longitude);
  const avgTonnes = totalFarms > 0 ? totalTonnes / totalFarms : 0;
  const sharedCostPerFarm = totalFarms > 0 ? totalMrvCostUsd / totalFarms : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-forest-light p-4">
        <div className="text-sm text-white font-semibold">Sri Lanka Aggregation Pool</div>
        <div className="text-xs text-gray-400 mt-1">
          Live view of pooled farms, share allocation, and Verra threshold progress.
        </div>
      </div>

      {/* Pool stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-2xl font-bold text-carbon-400">{totalFarms}</div>
          <div className="text-xs text-gray-400">Farms in pool</div>
        </div>
        <div className="rounded-xl bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-2xl font-bold text-white">{formatTonnes(totalTonnes)}</div>
          <div className="text-xs text-gray-400">Total CO₂</div>
        </div>
        <div className="rounded-xl bg-forest-light border border-white/5 p-3 text-center">
          <div className="text-2xl font-bold text-white">{formatTonnes(avgTonnes)}</div>
          <div className="text-xs text-gray-400">Avg / farm</div>
        </div>
        <div className={`rounded-xl border p-3 text-center ${meetsMinimum ? "bg-carbon-900/30 border-carbon-700/50" : "bg-yellow-900/20 border-yellow-700/50"}`}>
          <div className={`text-sm font-bold ${meetsMinimum ? "text-carbon-400" : "text-yellow-400"}`}>
            {meetsMinimum ? "✓ Verra Ready" : "Building…"}
          </div>
          <div className="text-xs text-gray-400">Min {formatTonnes(verraMinimumTonnes)}</div>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 340 }}>
        <MapContainer
          center={[7.0, 80.7]}
          zoom={8}
          style={{ height: "100%", width: "100%", background: "#0d1f14" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {withCoords.map((m) => (
            <CircleMarker
              key={m.farm_id}
              center={[m.latitude!, m.longitude!]}
              radius={markerRadius(m.tonnes_co2)}
              pathOptions={{
                fillColor: markerColor(m.crop_type),
                fillOpacity: 0.8,
                color: "white",
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold">{m.farmer_name}</div>
                  <div className="text-gray-600">{m.district}</div>
                  <div>{CROP_LABELS[m.crop_type] ?? m.crop_type}</div>
                  <div className="font-medium text-green-700">{formatTonnes(m.tonnes_co2)}</div>
                  <div>Share: {m.share_pct.toFixed(2)}%</div>
                  <div>Payout: {formatUSD(m.payout_usd)}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Shared MRV cost callout */}
      <div className="rounded-lg bg-blue-900/20 border border-blue-700/30 p-3 text-sm">
        <span className="text-blue-300 font-medium">{formatUSD(totalMrvCostUsd)} verification cost</span>
        <span className="text-gray-400"> split {totalFarms} ways = </span>
        <span className="text-white font-bold">{formatUSD(sharedCostPerFarm)}/farm</span>
        <span className="text-gray-400"> vs $15,000–$80,000 individually</span>
      </div>

      <div className="text-xs text-gray-500">
        Showing {withCoords.length} mapped farms with geolocation data.
      </div>
    </div>
  );
}
