import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle2, Satellite, Layers, Brain, Shield, GitMerge } from "lucide-react";
import type { FarmInput, NDVITile } from "../../types";
import { CROP_LABELS } from "../../utils/formatters";

// Leaflet icon fix
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:20px;height:20px;
    background:#10b981;
    border:2px solid #fff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

interface StepDef {
  icon: React.ReactNode;
  label: string;
  detail: string;
}

const PIPELINE_STEPS: StepDef[] = [
  {
    icon: <Layers className="w-4 h-4" />,
    label: "IPCC Tier-2 Calculation",
    detail: "SOC stock-change Eq.2.25 · climate zone lookup · emission factors",
  },
  {
    icon: <Satellite className="w-4 h-4" />,
    label: "GEE Satellite Data",
    detail: "Sentinel-2 NDVI · ERA5 weather · SoilGrids depth",
  },
  {
    icon: <Brain className="w-4 h-4" />,
    label: "KGML GRU Model",
    detail: "Physics-constrained GRU · mass balance check · δ-SOC prediction",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    label: "Fraud Detection",
    detail: "NDVI change vector · land-cover anomaly scoring",
  },
  {
    icon: <GitMerge className="w-4 h-4" />,
    label: "Ensemble & Verification",
    detail: "IPCC/KGML weight blending · claim status · confidence score",
  },
];

interface Props {
  farm: FarmInput;
  ndviTile: NDVITile | null;
  ndviLoading: boolean;
}

export function AnalyzingView({ farm, ndviTile, ndviLoading }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const ndviAdvancedRef = useRef(false);

  // Complete a step and move to next
  const completeStep = (step: number) => {
    setDoneSteps((prev) => new Set([...prev, step]));
    setActiveStep(step + 1);
  };

  // Auto-advance all steps except step 1 (GEE) which waits for ndviTile
  useEffect(() => {
    if (activeStep === 1 || activeStep >= PIPELINE_STEPS.length) return;

    const durations: Record<number, number> = { 0: 900, 2: 700, 3: 900, 4: 9999 };
    const ms = durations[activeStep] ?? 900;
    if (ms === 9999) return; // step 4 stays active until parent unmounts

    const t = setTimeout(() => completeStep(activeStep), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  // Step 1 (GEE): advance when ndviTile arrives, or fallback after 5.5s
  useEffect(() => {
    if (activeStep !== 1) return;

    const fallback = setTimeout(() => {
      if (!ndviAdvancedRef.current) {
        ndviAdvancedRef.current = true;
        completeStep(1);
      }
    }, 5500);

    return () => clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  useEffect(() => {
    if (!ndviTile || ndviAdvancedRef.current || activeStep !== 1) return;
    ndviAdvancedRef.current = true;
    const t = setTimeout(() => completeStep(1), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndviTile]);

  const lat = farm.latitude ?? 6.9271;
  const lng = farm.longitude ?? 80.7718;
  const cropLabel = CROP_LABELS[farm.crop_type] ?? farm.crop_type;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white">Analyzing Your Farm</h2>
        <p className="text-gray-400 text-sm">
          Running the 5-step KGML-ag-Carbon pipeline for <span className="text-white">{cropLabel}</span> in <span className="text-white">{farm.district}</span>.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Pipeline steps — wider column */}
        <div className="lg:col-span-3 space-y-2">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = doneSteps.has(i);
            const isActive = activeStep === i;
            const isPending = !isDone && !isActive;

            return (
              <div
                key={i}
                className={`rounded-xl border p-4 transition-all duration-300 ${
                  isActive
                    ? "border-carbon-600/60 bg-carbon-900/20"
                    : isDone
                      ? "border-carbon-800/30 bg-forest-dark/20"
                      : "border-white/5 bg-forest-dark/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div
                    className={`shrink-0 mt-0.5 ${
                      isDone ? "text-carbon-400" : isActive ? "text-carbon-500" : "text-gray-600"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isActive ? (
                      <span className="inline-block w-5 h-5 border-2 border-carbon-800/60 border-t-carbon-400 rounded-full animate-spin" />
                    ) : (
                      <span className="inline-block w-5 h-5 rounded-full border-2 border-white/10" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={isDone ? "text-carbon-400" : isActive ? "text-white" : "text-gray-600"}>
                        {step.icon}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isActive ? "text-white" : isDone ? "text-carbon-300" : "text-gray-500"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${isPending ? "text-gray-600" : "text-gray-400"}`}>
                      {step.detail}
                    </div>

                    {/* GEE step live sub-status */}
                    {i === 1 && isActive && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-carbon-500">
                        <span className="w-2 h-2 rounded-full bg-carbon-500 animate-pulse" />
                        {ndviLoading
                          ? "Fetching Sentinel-2 tiles from Google Earth Engine..."
                          : ndviTile
                            ? "Tile received — processing NDVI data..."
                            : "Connecting to GEE API..."}
                      </div>
                    )}
                  </div>

                  {/* Step counter */}
                  <span
                    className={`text-xs font-mono shrink-0 tabular-nums ${
                      isDone ? "text-carbon-600" : isActive ? "text-carbon-500" : "text-gray-700"
                    }`}
                  >
                    {i + 1}/5
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right panel: mini-map + NDVI card */}
        <div className="lg:col-span-2 space-y-3">
          {/* Mini-map */}
          <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ height: 190 }}>
            <MapContainer
              center={[lat, lng]}
              zoom={10}
              style={{ width: "100%", height: "100%" }}
              scrollWheelZoom={false}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[lat, lng]} icon={PIN_ICON} />
            </MapContainer>
          </div>
          <div className="text-xs text-gray-500 text-center">
            {lat.toFixed(4)}, {lng.toFixed(4)} · {farm.district}
          </div>

          {/* NDVI card — shown when tile loads */}
          {ndviTile ? (
            <div className="rounded-xl border border-white/10 bg-forest-light p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5 text-carbon-400" />
                  Sentinel-2 NDVI
                </div>
                <span
                  className="text-sm font-mono font-bold"
                  style={{ color: ndviToColor(ndviTile.ndvi_score) }}
                >
                  {ndviTile.ndvi_score.toFixed(3)}
                </span>
              </div>

              {/* NDVI progress bar */}
              <div className="space-y-1">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 relative overflow-visible">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow border border-gray-200 transition-all duration-700"
                    style={{ left: `calc(${Math.min(1, Math.max(0, ndviTile.ndvi_score)) * 100}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Low</span>
                  <span>Vegetation Index</span>
                  <span>High</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-forest-dark/60 p-2">
                  <div className="text-gray-500 mb-0.5">Source</div>
                  <div className="text-gray-300">{ndviTile.source}</div>
                </div>
                <div className="rounded-lg bg-forest-dark/60 p-2">
                  <div className="text-gray-500 mb-0.5">Date</div>
                  <div className="text-gray-300">{ndviTile.date}</div>
                </div>
              </div>
              {ndviTile.note && (
                <div className="text-xs text-gray-500 leading-relaxed">{ndviTile.note}</div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-forest-dark/40 p-4 flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-carbon-800/60 border-t-carbon-600 rounded-full animate-spin shrink-0" />
              <span className="text-xs text-gray-500">
                Fetching satellite NDVI data for {farm.district}...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ndviToColor(score: number): string {
  if (score < 0.3) return "#ef4444";
  if (score < 0.5) return "#f59e0b";
  if (score < 0.65) return "#84cc16";
  return "#22c55e";
}
