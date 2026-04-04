import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle, Trash2, Flag, RefreshCw,
  Shield, Leaf, Coins, BarChart3, ChevronDown, ChevronUp, Eye, EyeOff,
  LayoutDashboard, ClipboardList, Sprout, BadgeCheck, Activity,
  LogOut, ExternalLink, Circle, Server, Cpu, Link2, FileText, ShieldCheck, ShieldX,
} from "lucide-react";
import { api } from "../services/api";
import type { FarmRecord, AdminStats, AdminCreditRecord, KGMLStatus, BlockchainHealth } from "../types";
import { CROP_LABELS, formatTonnes, formatUSD } from "../utils/formatters";

// ── Constants ────────────────────────────────────────────────────────────────

const ADMIN_KEY_STORAGE = "cl_admin_key";
type Section = "overview" | "flagged" | "farms" | "credits" | "system";
type ClaimStatus = "VERIFIED" | "UNVERIFIED" | "SUSPICIOUS" | "REJECTED";

const STATUS_STYLES: Record<ClaimStatus, string> = {
  VERIFIED:   "bg-green-900/30 text-green-400 border-green-700/40",
  UNVERIFIED: "bg-slate-800/60 text-slate-400 border-slate-700/40",
  SUSPICIOUS: "bg-yellow-900/30 text-yellow-400 border-yellow-700/40",
  REJECTED:   "bg-red-900/30 text-red-400 border-red-700/40",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status as ClaimStatus) || "UNVERIFIED";
  const icons: Record<ClaimStatus, React.ReactNode> = {
    VERIFIED:   <CheckCircle2 className="w-3 h-3" />,
    UNVERIFIED: <Circle className="w-3 h-3" />,
    SUSPICIOUS: <AlertTriangle className="w-3 h-3" />,
    REJECTED:   <XCircle className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLES[s] ?? STATUS_STYLES.UNVERIFIED}`}>
      {icons[s]}
      {s}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel, danger, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: (reason?: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-gray-400 text-sm">{message}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason / note..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm">Cancel</button>
          <button
            onClick={() => onConfirm(reason || undefined)}
            className={`px-4 py-2 rounded-lg text-white text-sm font-semibold ${danger ? "bg-red-700 hover:bg-red-600" : "bg-emerald-700 hover:bg-emerald-600"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.adminStats(key);
      localStorage.setItem(ADMIN_KEY_STORAGE, key);
      onLogin(key);
    } catch {
      setError("Invalid key.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-900/30 border border-emerald-700/40 mb-4">
            <Shield className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">CarbonMicro platform management</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Admin secret key"
              autoFocus
              className="w-full px-4 py-3 pr-10 rounded-xl bg-[#1e293b] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 text-sm"
            />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          <button
            type="submit" disabled={busy || !key}
            className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {busy ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview",       icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "flagged",  label: "Flagged",        icon: <AlertTriangle className="w-4 h-4" /> },
  { key: "farms",    label: "Farms",          icon: <Sprout className="w-4 h-4" /> },
  { key: "credits",  label: "Credits",        icon: <BadgeCheck className="w-4 h-4" /> },
  { key: "system",   label: "System",         icon: <Activity className="w-4 h-4" /> },
];

function Sidebar({
  section, flaggedCount, onNav, onRefresh, onLogout, loading,
}: {
  section: Section; flaggedCount: number;
  onNav: (s: Section) => void; onRefresh: () => void;
  onLogout: () => void; loading: boolean;
}) {
  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen bg-[#0a1628] border-r border-white/8 sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-700/30 border border-emerald-600/40 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">CarbonMicro</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNav(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={active ? "text-emerald-400" : "text-gray-500"}>{item.icon}</span>
              {item.label}
              {item.key === "flagged" && flaggedCount > 0 && (
                <span className="ml-auto bg-yellow-500/20 text-yellow-400 border border-yellow-600/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {flaggedCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-white/8 space-y-0.5">
        <button
          onClick={onRefresh} disabled={loading}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <a
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View Site
        </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:text-red-400 hover:bg-red-900/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ── Overview section ──────────────────────────────────────────────────────────

function OverviewSection({ stats, onNavigate }: { stats: AdminStats; onNavigate: (s: Section) => void }) {
  const kpis = [
    { label: "Total Farms",     value: stats.total_farms,         sub: `${stats.pooled_farms} in pool`,          color: "text-white",        accent: "border-white/10  bg-[#1e293b]" },
    { label: "Needs Review",    value: stats.flagged_count,        sub: "flagged submissions",                    color: "text-yellow-400",   accent: "border-yellow-700/30 bg-yellow-900/10", action: () => onNavigate("flagged") },
    { label: "Credits Minted",  value: stats.total_credits,        sub: `${stats.on_chain_credits} on-chain`,    color: "text-blue-400",     accent: "border-blue-700/20 bg-blue-900/10" },
    { label: "Retired",         value: stats.retired_credits,      sub: "permanently consumed",                  color: "text-emerald-400",  accent: "border-emerald-700/20 bg-emerald-900/10" },
    { label: "Total CO2",       value: formatTonnes(stats.total_tonnes_co2), sub: "across all farms",            color: "text-purple-400",   accent: "border-purple-700/20 bg-purple-900/10" },
  ];

  const total = Object.values(stats.claim_status_counts).reduce((a, b) => a + b, 0) || 1;
  const statusColors: Record<ClaimStatus, string> = {
    VERIFIED: "bg-emerald-500", UNVERIFIED: "bg-slate-500",
    SUSPICIOUS: "bg-yellow-500", REJECTED: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Overview</h2>
        <p className="text-gray-500 text-sm mt-0.5">Platform snapshot — live from database.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            onClick={k.action}
            className={`rounded-xl border p-4 ${k.accent} ${k.action ? "cursor-pointer hover:brightness-110 transition-all" : ""}`}
          >
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-600 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Claim status breakdown */}
      <div className="rounded-xl border border-white/10 bg-[#1e293b] p-5 space-y-4">
        <div className="text-sm font-semibold text-white">Claim Status Breakdown</div>

        {/* Bar */}
        <div className="flex rounded-full overflow-hidden h-3 gap-px">
          {(["VERIFIED", "UNVERIFIED", "SUSPICIOUS", "REJECTED"] as ClaimStatus[]).map((s) => {
            const pct = (stats.claim_status_counts[s] / total) * 100;
            return pct > 0 ? (
              <div key={s} className={`${statusColors[s]} transition-all`} style={{ width: `${pct}%` }} title={`${s}: ${stats.claim_status_counts[s]}`} />
            ) : null;
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["VERIFIED", "UNVERIFIED", "SUSPICIOUS", "REJECTED"] as ClaimStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${statusColors[s]}`} />
              <span className="text-xs text-gray-400">{s}</span>
              <span className="text-xs font-bold text-white ml-auto">{stats.claim_status_counts[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {stats.flagged_count > 0 && (
        <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            <div>
              <div className="text-yellow-300 font-semibold text-sm">{stats.flagged_count} submission{stats.flagged_count !== 1 ? "s" : ""} need review</div>
              <div className="text-yellow-500/70 text-xs mt-0.5">Approve or reject each flagged farm before minting proceeds.</div>
            </div>
          </div>
          <button
            onClick={() => onNavigate("flagged")}
            className="shrink-0 px-4 py-2 rounded-lg bg-yellow-700/40 hover:bg-yellow-700/60 text-yellow-300 text-sm font-medium transition-colors border border-yellow-600/30"
          >
            Review Now
          </button>
        </div>
      )}
    </div>
  );
}

// ── Farm row ──────────────────────────────────────────────────────────────────

function FarmRow({ farm, adminKey, onAction }: { farm: FarmRecord; adminKey: string; onAction: (action: string) => void }) {
  const [expanded, setExpanded] = useState(!farm.admin_approved && !!farm.land_proof_url);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "reject" | "flag" | "delete" | null>(null);
  const proofFullUrl = farm.land_proof_url
    ? `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}${farm.land_proof_url}`
    : null;
  const isImage = farm.land_proof_url ? /\.(jpg|jpeg|png|webp)$/i.test(farm.land_proof_url) : false;

  const act = async (action: typeof confirm, reason?: string) => {
    if (!action) return;
    setBusy(true); setConfirm(null);
    try {
      if (action === "approve") await api.adminApproveFarm(adminKey, farm.id, reason);
      else if (action === "reject") await api.adminRejectFarm(adminKey, farm.id, reason);
      else if (action === "flag")   await api.adminFlagFarm(adminKey, farm.id, reason);
      else if (action === "delete") await api.adminDeleteFarm(adminKey, farm.id);
      onAction(action);
    } finally { setBusy(false); }
  };

  return (
    <>
      {confirm && (
        <ConfirmDialog
          title={confirm === "approve" ? "Approve Submission" : confirm === "reject" ? "Reject Submission" : confirm === "flag" ? "Flag for Review" : "Delete Farm"}
          message={
            confirm === "approve" ? `Mark farm #${farm.id} (${farm.farmer_name}) as VERIFIED?` :
            confirm === "reject"  ? `Mark farm #${farm.id} as REJECTED? Blocks pool and minting.` :
            confirm === "flag"    ? `Flag farm #${farm.id} as SUSPICIOUS for review?` :
            `Permanently delete farm #${farm.id} and all its credits?`
          }
          confirmLabel={confirm === "delete" ? "Delete" : confirm === "reject" ? "Reject" : confirm === "flag" ? "Flag" : "Approve"}
          danger={confirm === "delete" || confirm === "reject"}
          onConfirm={(r) => act(confirm, r)}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className={`rounded-xl border transition-colors ${
        farm.anomaly_flag ? "border-yellow-700/25 bg-yellow-900/5" :
        farm.claim_status === "REJECTED" ? "border-red-700/25 bg-red-900/5" :
        "border-white/8 bg-[#1e293b]/60"
      }`}>
        <div className="px-4 py-3 flex items-center gap-3">
          {farm.anomaly_flag && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}

          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
            {/* Identity — 3 cols */}
            <div className="col-span-4 min-w-0">
              <div className="text-sm font-medium text-white truncate">{farm.farmer_name}</div>
              <div className="text-xs text-gray-500 truncate">{farm.district} · {CROP_LABELS[farm.crop_type] ?? farm.crop_type}</div>
            </div>
            {/* CO2 — 2 cols */}
            <div className="col-span-2">
              <div className="text-sm text-white font-medium">{formatTonnes(farm.estimated_tonnes_co2 ?? 0)}</div>
              <div className="text-xs text-gray-600">{farm.land_area_ha.toFixed(1)} ha</div>
            </div>
            {/* Status — 2 cols */}
            <div className="col-span-2">
              <StatusBadge status={farm.claim_status} />
            </div>
            {/* Meta — 2 cols */}
            <div className="col-span-2 text-xs text-gray-600">
              #{farm.id} · {formatDate(farm.created_at)}
              {farm.in_pool && <div className="text-emerald-600 mt-0.5">In pool</div>}
            </div>
            {/* Actions — 2 cols */}
            <div className="col-span-2 flex items-center gap-1 justify-end">
              {farm.claim_status !== "VERIFIED" && (
                <button
                  onClick={() => {
                    if (!farm.land_proof_url) { setExpanded(true); return; }
                    setExpanded(true);
                    setConfirm("approve");
                  }}
                  disabled={busy || !farm.land_proof_url}
                  title={farm.land_proof_url ? "Approve" : "Proof document required"}
                  className={`p-1.5 rounded-lg border ${
                    farm.land_proof_url
                      ? "border-green-700/40 text-green-400 hover:bg-green-900/30"
                      : "border-gray-700/40 text-gray-600"
                  } disabled:opacity-40`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              )}
              {farm.claim_status !== "REJECTED" && (
                <button onClick={() => setConfirm("reject")} disabled={busy} title="Reject"
                  className="p-1.5 rounded-lg border border-red-700/40 text-red-400 hover:bg-red-900/30 disabled:opacity-40">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {!farm.anomaly_flag && (
                <button onClick={() => setConfirm("flag")} disabled={busy} title="Flag"
                  className="p-1.5 rounded-lg border border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/30 disabled:opacity-40">
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-white">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setConfirm("delete")} disabled={busy} title="Delete"
                className="p-1.5 rounded-lg border border-red-900/30 text-red-700 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-white/8 px-4 py-3 space-y-3">
            {/* Farm details */}
            <div className="grid sm:grid-cols-4 gap-2 text-xs text-gray-500">
              <div><span className="text-gray-600">Practice:</span> <span className="text-gray-400">{farm.practice_change}</span></div>
              <div><span className="text-gray-600">Years:</span> <span className="text-gray-400">{farm.years_since_change}</span></div>
              <div><span className="text-gray-600">Lat/Lng:</span> <span className="text-gray-400 font-mono">{farm.latitude?.toFixed(4) ?? "—"}, {farm.longitude?.toFixed(4) ?? "—"}</span></div>
              <div><span className="text-gray-600">Pool:</span> <span className="text-gray-400">{farm.in_pool ? "Yes" : "No"}</span></div>
              {farm.claim_status_reason && (
                <div className="sm:col-span-4"><span className="text-gray-600">Note:</span> <span className="text-gray-400">{farm.claim_status_reason}</span></div>
              )}
            </div>

            {/* Approval badge */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                farm.admin_approved
                  ? "bg-green-900/30 text-green-400 border-green-700/40"
                  : "bg-orange-900/30 text-orange-400 border-orange-700/40"
              }`}>
                {farm.admin_approved ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                {farm.admin_approved ? "Admin Approved" : "Not Approved"}
              </span>
            </div>

            {/* Inline proof document viewer */}
            {proofFullUrl ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Land Ownership Proof
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden bg-white">
                  {isImage ? (
                    <img
                      src={proofFullUrl}
                      alt="Land proof document"
                      className="w-full max-h-[500px] object-contain"
                    />
                  ) : (
                    <iframe
                      src={proofFullUrl}
                      title="Land proof document"
                      className="w-full border-0"
                      style={{ height: 500 }}
                    />
                  )}
                </div>
                <a
                  href={proofFullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open in new tab
                </a>
              </div>
            ) : (
              <div className="rounded-lg border border-red-700/30 bg-red-900/15 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>Cannot approve — land ownership proof document has not been uploaded by the farmer.</span>
              </div>
            )}

            {/* Quick action buttons — right below the proof */}
            {!farm.admin_approved && proofFullUrl && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setConfirm("approve")}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Farm
                </button>
                <button
                  onClick={() => setConfirm("reject")}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Flagged section ───────────────────────────────────────────────────────────

function FlaggedSection({ farms, adminKey, onAction }: { farms: FarmRecord[]; adminKey: string; onAction: (action: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Review Queue</h2>
        <p className="text-gray-500 text-sm mt-0.5">Submissions with anomaly flags or SUSPICIOUS / REJECTED status.</p>
      </div>

      {farms.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#1e293b] p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-800 mx-auto mb-3" />
          <div className="text-gray-300 font-medium">Queue is clear</div>
          <div className="text-gray-600 text-sm mt-1">No flagged submissions. New anomalies will appear here automatically.</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-yellow-400 rounded-lg border border-yellow-700/30 bg-yellow-900/10 px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {farms.length} submission{farms.length !== 1 ? "s" : ""} pending review
          </div>
          <div className="space-y-2">
            {farms.map(farm => <FarmRow key={farm.id} farm={farm} adminKey={adminKey} onAction={onAction} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Farms section ─────────────────────────────────────────────────────────────

function FarmsSection({ farms, adminKey, onAction }: { farms: FarmRecord[]; adminKey: string; onAction: (action: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = farms.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = !q || f.farmer_name.toLowerCase().includes(q) || f.district.toLowerCase().includes(q) || f.crop_type.includes(q);
    const matchStatus = statusFilter === "ALL" || f.claim_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">All Farms</h2>
          <p className="text-gray-500 text-sm mt-0.5">{farms.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, district, crop..."
            className="px-3 py-2 rounded-lg bg-[#1e293b] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 w-56"
          />
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#1e293b] border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="ALL">All statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="SUSPICIOUS">Suspicious</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(farm => <FarmRow key={farm.id} farm={farm} adminKey={adminKey} onAction={onAction} />)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No farms match your filter.</div>
        )}
      </div>
    </div>
  );
}

// ── Credits section ───────────────────────────────────────────────────────────

function CreditsSection({ adminKey }: { adminKey: string }) {
  const [credits, setCredits] = useState<AdminCreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<AdminCreditRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setCredits(await api.adminGetAllCredits(adminKey)); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const retire = async (tokenId: number, reason?: string) => {
    setBusy(true); setConfirm(null);
    try { await api.adminRetireCredit(adminKey, tokenId, reason); await load(); }
    finally { setBusy(false); }
  };

  const filtered = credits.filter(c => {
    const q = search.toLowerCase();
    return !q || c.farmer_name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || String(c.token_id).includes(q);
  });

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmDialog
          title="Force Retire Credit"
          message={`Retire token #${confirm.token_id} (${formatTonnes(confirm.tonnes_co2)}) from ${confirm.farmer_name}?`}
          confirmLabel="Retire" danger
          onConfirm={r => retire(confirm.token_id, r)}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Credit Tokens</h2>
          <p className="text-gray-500 text-sm mt-0.5">{credits.length} total tokens</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search farmer, token ID..."
            className="px-3 py-2 rounded-lg bg-[#1e293b] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 w-52"
          />
          <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/10 text-gray-500 hover:text-white disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Loading credits...</div>
      ) : (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#0f172a]">
                {["Token", "Farmer", "District", "Crop", "Tonnes", "Claim", "Chain", "Status", "Minted", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-emerald-500 text-xs">#{c.token_id}</td>
                  <td className="px-3 py-2.5 text-white max-w-[110px] truncate text-xs">{c.farmer_name}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{c.district}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[90px] truncate">{CROP_LABELS[c.crop_type] ?? c.crop_type}</td>
                  <td className="px-3 py-2.5 text-white text-xs">{formatTonnes(c.tonnes_co2)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.farm_claim_status} /></td>
                  <td className="px-3 py-2.5 text-xs">
                    {c.on_chain
                      ? <span className="text-emerald-400 font-medium">On-chain</span>
                      : <span className="text-gray-600">Simulated</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {c.retired
                      ? <span className="text-gray-600">Retired</span>
                      : <span className="text-emerald-500">Active</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{formatDate(c.minted_at)}</td>
                  <td className="px-3 py-2.5">
                    {!c.retired && (
                      <button onClick={() => setConfirm(c)} disabled={busy}
                        className="text-xs text-red-600 hover:text-red-400 border border-red-900/30 rounded px-2 py-0.5 disabled:opacity-40">
                        Retire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-600 text-sm">No credits found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── System section ────────────────────────────────────────────────────────────

function SystemSection({ adminKey }: { adminKey: string }) {
  const [kgml, setKgml] = useState<KGMLStatus | null>(null);
  const [chain, setChain] = useState<BlockchainHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([api.getKGMLStatus(), api.getBlockchainHealth()]);
      setKgml(k); setChain(c);
    } catch { /* partial load ok */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function Dot({ ok }: { ok: boolean }) {
    return <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
  }

  function HealthCard({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: { label: string; value: React.ReactNode }[] }) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#1e293b] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">{icon}{title}</div>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{r.label}</span>
              <span className="text-gray-300 font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">System Health</h2>
          <p className="text-gray-500 text-sm mt-0.5">MRV pipeline, GEE, and blockchain status.</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/10 text-gray-500 hover:text-white disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Checking services...</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <HealthCard
            icon={<Cpu className="w-4 h-4 text-purple-400" />}
            title="KGML Model"
            rows={kgml ? [
              { label: "Model loaded",   value: <span className="flex items-center gap-1.5"><Dot ok={kgml.kgml_model_loaded} />{kgml.kgml_model_loaded ? "Loaded" : "Not loaded"}</span> },
              { label: "GEE connection", value: <span className="flex items-center gap-1.5"><Dot ok={kgml.gee_connected} />{kgml.gee_connected ? "Connected" : "Disconnected"}</span> },
            ] : [{ label: "Status", value: <span className="text-gray-600">Unavailable</span> }]}
          />

          <HealthCard
            icon={<Server className="w-4 h-4 text-blue-400" />}
            title="Blockchain"
            rows={chain ? [
              { label: "Enabled",   value: <span className="flex items-center gap-1.5"><Dot ok={chain.enabled} />{chain.enabled ? "Yes" : "No"}</span> },
              { label: "Connected", value: <span className="flex items-center gap-1.5"><Dot ok={!!chain.connected} />{chain.connected ? "Yes" : "No"}</span> },
              { label: "Chain ID",  value: chain.chain_id ?? "—" },
              { label: "Balance",   value: chain.verifier_balance_pol != null ? `${chain.verifier_balance_pol.toFixed(4)} POL` : "—" },
            ] : [{ label: "Status", value: <span className="text-gray-600">Unavailable</span> }]}
          />

          <HealthCard
            icon={<Link2 className="w-4 h-4 text-emerald-400" />}
            title="Smart Contract"
            rows={chain ? [
              { label: "Address",    value: chain.contract_address ? <span className="font-mono text-emerald-400">{chain.contract_address.slice(0,6)}...{chain.contract_address.slice(-4)}</span> : <span className="text-gray-600">Not deployed</span> },
              { label: "Network",    value: "Polygon Amoy" },
              { label: "Standard",   value: "ERC-1155" },
              { label: "Verifier",   value: chain.verifier_address ? <span className="font-mono">{chain.verifier_address.slice(0,6)}...{chain.verifier_address.slice(-4)}</span> : "—" },
            ] : [{ label: "Status", value: <span className="text-gray-600">Unavailable</span> }]}
          />

          <HealthCard
            icon={<BarChart3 className="w-4 h-4 text-orange-400" />}
            title="API Server"
            rows={[
              { label: "Status",    value: <span className="flex items-center gap-1.5"><Dot ok={true} />Running</span> },
              { label: "Base URL",  value: <span className="font-mono text-xs">{import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}</span> },
            ]}
          />

          <HealthCard
            icon={<Coins className="w-4 h-4 text-yellow-400" />}
            title="Pricing Config"
            rows={[
              { label: "Carbon price min", value: formatUSD(8) + " / t" },
              { label: "Carbon price max", value: formatUSD(15) + " / t" },
              { label: "Platform fee",     value: "6%" },
              { label: "Verra minimum",    value: "10,000 t CO2" },
            ]}
          />

          <HealthCard
            icon={<ClipboardList className="w-4 h-4 text-gray-400" />}
            title="Admin"
            rows={[
              { label: "Auth",       value: "X-Admin-Key header" },
              { label: "Key set",    value: <span className="flex items-center gap-1.5"><Dot ok={true} />Yes</span> },
              { label: "Seed data",  value: "python -m app.db.seed" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(ADMIN_KEY_STORAGE) ?? "");
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [flaggedFarms, setFlaggedFarms] = useState<FarmRecord[]>([]);
  const [allFarms, setAllFarms] = useState<FarmRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const [s, f, a] = await Promise.all([
        api.adminStats(key),
        api.adminGetFlaggedFarms(key),
        api.adminGetAllFarms(key),
      ]);
      setStats(s); setFlaggedFarms(f); setAllFarms(a);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    api.adminStats(adminKey)
      .then(s => { setStats(s); setAuthed(true); loadAll(adminKey); })
      .catch(() => { localStorage.removeItem(ADMIN_KEY_STORAGE); setAdminKey(""); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (key: string) => { setAdminKey(key); setAuthed(true); loadAll(key); };
  const logout = () => { localStorage.removeItem(ADMIN_KEY_STORAGE); setAdminKey(""); setAuthed(false); setStats(null); };

  if (!authed) return <LoginScreen onLogin={login} />;

  return (
    <div className="flex h-screen bg-[#020617] text-white overflow-hidden">
      <Sidebar
        section={section}
        flaggedCount={flaggedFarms.length}
        onNav={setSection}
        onRefresh={() => loadAll(adminKey)}
        onLogout={logout}
        loading={loading}
      />

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 border-b border-white/8 bg-[#020617]/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Admin</span>
            <span className="text-gray-700">/</span>
            <span className="text-white font-medium capitalize">{section}</span>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>{stats.total_farms} farms</span>
              <span>{stats.total_credits} credits</span>
              {stats.flagged_count > 0 && (
                <span className="text-yellow-500 font-medium">{stats.flagged_count} flagged</span>
              )}
            </div>
          )}
        </div>

        {/* Section content */}
        <div className="px-6 py-6">
          {section === "overview" && stats && (
            <OverviewSection stats={stats} onNavigate={setSection} />
          )}
          {section === "flagged" && (
            <FlaggedSection farms={flaggedFarms} adminKey={adminKey} onAction={() => loadAll(adminKey)} />
          )}
          {section === "farms" && (
            <FarmsSection farms={allFarms} adminKey={adminKey} onAction={(action) => {
              loadAll(adminKey);
              if (action === "reject" || action === "flag") setSection("flagged");
            }} />
          )}
          {section === "credits" && <CreditsSection adminKey={adminKey} />}
          {section === "system"  && <SystemSection adminKey={adminKey} />}

          {section === "overview" && !stats && (
            <div className="text-center py-20 text-gray-600">Loading...</div>
          )}
        </div>
      </main>
    </div>
  );
}
