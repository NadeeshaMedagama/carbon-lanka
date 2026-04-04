import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Tab = "signup" | "login";

export default function AuthPage() {
  const { signup, login } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("signup");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupName.trim()) { setError("Name is required."); return; }
    if (!signupEmail.trim()) { setError("Email is required."); return; }
    if (signupPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (signupPassword !== signupConfirm) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      await signup(signupName.trim(), signupEmail.trim(), signupPassword);
      navigate("/farmer");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim()) { setError("Email is required."); return; }
    if (!loginPassword) { setError("Password is required."); return; }
    setSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      navigate("/farmer");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-forest-dark border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-carbon-600 focus:ring-1 focus:ring-carbon-600/50 transition-colors";

  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Carbon<span className="text-carbon-400">Micro</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Track and manage your farm carbon credits
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-forest-light overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              type="button"
              onClick={() => switchTab("signup")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === "signup"
                  ? "text-white border-b-2 border-carbon-500 bg-forest-dark/40"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "text-white border-b-2 border-carbon-500 bg-forest-dark/40"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Sign In
            </button>
          </div>

          <div className="p-6">
            {/* Sign Up form */}
            {tab === "signup" && (
              <form onSubmit={handleSignup} noValidate className="space-y-4">
                <div>
                  <label htmlFor="su-name" className={labelClass}>Full name</label>
                  <input
                    id="su-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Nimal Perera"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="su-email" className={labelClass}>Email address</label>
                  <input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nimal@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="su-password" className={labelClass}>Password</label>
                  <input
                    id="su-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="su-confirm" className={labelClass}>Confirm password</label>
                  <input
                    id="su-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-2.5 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("login")}
                    className="text-carbon-400 hover:text-carbon-300 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Log In form */}
            {tab === "login" && (
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                <div>
                  <label htmlFor="li-email" className={labelClass}>Email address</label>
                  <input
                    id="li-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nimal@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="li-password" className={labelClass}>Password</label>
                  <input
                    id="li-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-2.5 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg bg-carbon-600 hover:bg-carbon-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>

                <p className="text-center text-xs text-gray-500">
                  New to CarbonMicro?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signup")}
                    className="text-carbon-400 hover:text-carbon-300 transition-colors"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          CryptX 2.0 Finals Demo Build
        </p>
      </div>
    </div>
  );
}
