import { MapContainer, TileLayer, Rectangle, Tooltip } from "react-leaflet";
import type { NDVITile } from "../../types";
import "leaflet/dist/leaflet.css";

interface Props {
  ndvi: NDVITile;
}

// Color interpolation: red(0) → yellow(0.5) → green(1)
function ndviToColor(score: number): string {
  if (score < 0.3) return "#ef4444";
  if (score < 0.5) return "#f59e0b";
  if (score < 0.65) return "#84cc16";
  return "#22c55e";
}

export function SatelliteView({ ndvi }: Props) {
  const color = ndviToColor(ndvi.ndvi_score);
  const vegetationBand = ndvi.ndvi_score >= 0.65 ? "High vegetation" : ndvi.ndvi_score >= 0.5 ? "Moderate vegetation" : ndvi.ndvi_score >= 0.3 ? "Low vegetation" : "Very low vegetation";
  const bounds: [[number, number], [number, number]] = [
    [ndvi.bbox.south, ndvi.bbox.west],
    [ndvi.bbox.north, ndvi.bbox.east],
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-forest-light p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Satellite NDVI Cross-Check</div>
          <div className="text-xs text-gray-400">Sentinel-2 imagery corroborates submitted farm activity data.</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">NDVI score</div>
          <div className="text-carbon-300 font-bold">{ndvi.ndvi_score.toFixed(2)}</div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 280 }}>
        <MapContainer
          center={[ndvi.center.lat, ndvi.center.lng]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Rectangle
            bounds={bounds}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}
          >
            <Tooltip permanent direction="center">
              <div className="text-center text-xs">
                <div className="font-bold">NDVI: {ndvi.ndvi_score.toFixed(2)}</div>
                <div>Sentinel-2 · {ndvi.date}</div>
              </div>
            </Tooltip>
          </Rectangle>
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="text-red-400">Low</span>
        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
        <span className="text-green-400">High</span>
        <span className="ml-2">NDVI Vegetation Index</span>
      </div>

      <div className="rounded-lg bg-forest-light border border-white/5 p-3 text-xs text-gray-400 space-y-1">
        <div>
          <span className="text-gray-300 font-medium">Interpretation:</span> {vegetationBand}
        </div>
        <div>
          <span className="text-gray-300 font-medium">Source:</span> {ndvi.source} · <span className="text-gray-300">{ndvi.date}</span>
        </div>
        <div className="text-gray-500">{ndvi.note}</div>
      </div>
    </div>
  );
}
