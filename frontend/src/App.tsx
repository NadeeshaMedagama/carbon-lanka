import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Leaf } from "lucide-react";
import Home from "./pages/Home";
import FarmerPage from "./pages/FarmerPage";
import Marketplace from "./pages/Marketplace";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import FarmerDashboard from "./pages/FarmerDashboard";
import AdminPage from "./pages/AdminPage";
import { WalletConnect } from "./components/WalletConnect/WalletConnect";
import { AuthProvider } from "./contexts/AuthContext";

function GlobalHeader() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-carbon-900/40 text-carbon-300 border border-carbon-700/40 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-forest-dark/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-2 font-bold text-white shrink-0">
          <Leaf className="w-5 h-5 text-carbon-400" />
          <span className="tracking-tight">Carbon<span className="text-carbon-400">Micro</span></span>
        </NavLink>
        <div className="hidden md:flex items-center gap-1 rounded-xl border border-white/10 bg-forest-mid/60 p-1">
          <NavLink to="/" className={linkClass}>Overview</NavLink>
          <NavLink to="/farmer" className={linkClass}>Measure</NavLink>
          <NavLink to="/marketplace" className={linkClass}>Market</NavLink>
          <NavLink to="/dashboard" className={linkClass}>ESG</NavLink>
          <NavLink to="/my-farm" className={linkClass}>My Farm</NavLink>
        </div>
        <div className="shrink-0"><WalletConnect /></div>
      </div>
      <div className="md:hidden max-w-6xl mx-auto px-4 pb-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-forest-mid/60 p-1 overflow-x-auto">
          <NavLink to="/" className={linkClass}>Overview</NavLink>
          <NavLink to="/farmer" className={linkClass}>Measure</NavLink>
          <NavLink to="/marketplace" className={linkClass}>Market</NavLink>
          <NavLink to="/dashboard" className={linkClass}>ESG</NavLink>
          <NavLink to="/my-farm" className={linkClass}>My Farm</NavLink>
        </div>
      </div>
    </header>
  );
}

function GlobalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-forest-mid/40 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="font-semibold text-white">CarbonMicro</div>
          <p className="text-gray-400 mt-2 text-xs leading-relaxed">
            Carbon credit micro-marketplace for Sri Lankan SMEs powered by AI MRV,
            satellite verification, and blockchain tokenisation.
          </p>
        </div>
        <div>
          <div className="font-semibold text-white">Platform</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <NavLink to="/" className="text-gray-400 hover:text-white">Overview</NavLink>
            <span className="text-gray-600">•</span>
            <NavLink to="/farmer" className="text-gray-400 hover:text-white">Measure</NavLink>
            <span className="text-gray-600">•</span>
            <NavLink to="/marketplace" className="text-gray-400 hover:text-white">Marketplace</NavLink>
            <span className="text-gray-600">•</span>
            <NavLink to="/dashboard" className="text-gray-400 hover:text-white">ESG Dashboard</NavLink>
            <span className="text-gray-600">•</span>
            <NavLink to="/my-farm" className="text-gray-400 hover:text-white">My Farm</NavLink>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-semibold text-white">Compliance Focus</div>
          <p className="text-xs text-gray-400 mt-2">EU CBAM readiness · Verra-compatible pooling · On-chain retirement traceability</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-gray-500">
          © {year} CarbonMicro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function MainLayout() {
  return (
    <div className="min-h-screen bg-forest-dark text-white flex flex-col">
      <GlobalHeader />
      <main className="pb-12 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/farmer" element={<FarmerPage />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/my-farm" element={<FarmerDashboard />} />
        </Routes>
      </main>
      <GlobalFooter />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin: full-screen layout, no header/footer */}
          <Route path="/admin" element={<AdminPage />} />
          {/* Main app layout */}
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
