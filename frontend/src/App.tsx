import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import FarmerPage from "./pages/FarmerPage";
import Marketplace from "./pages/Marketplace";
import Dashboard from "./pages/Dashboard";
import { WalletConnect } from "./components/WalletConnect/WalletConnect";

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${isActive ? "text-carbon-400" : "text-gray-400 hover:text-white"}`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-forest-dark/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-1.5 font-bold text-white">
          🌿 Carbon<span className="text-carbon-400">Micro</span>
        </NavLink>
        <div className="flex items-center gap-5">
          <NavLink to="/farmer" className={linkClass}>Measure</NavLink>
          <NavLink to="/marketplace" className={linkClass}>Market</NavLink>
          <NavLink to="/dashboard" className={linkClass}>ESG</NavLink>
        </div>
        <WalletConnect />
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-forest-dark text-white">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/farmer" element={<FarmerPage />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
