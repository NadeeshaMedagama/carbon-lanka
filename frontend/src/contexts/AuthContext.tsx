import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface SavedEstimate {
  id: string;
  farmName: string;
  district: string;
  cropType: string;
  tonnes: number;
  valueUsdMin: number;
  valueUsdMax: number;
  confidence: number;
  claimStatus: string;
  savedAt: string;
}

export interface FarmerProfile {
  id: string;
  name: string;
  email: string;
  password: string;
  farms: string[];
  savedEstimates: SavedEstimate[];
}

interface AuthContextValue {
  user: FarmerProfile | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  saveEstimate: (estimate: Omit<SavedEstimate, "id" | "savedAt">) => void;
}

const STORAGE_KEY = "cl_user";
const ALL_USERS_KEY = "cl_users";

function loadUser(): FarmerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FarmerProfile) : null;
  } catch {
    return null;
  }
}

function loadAllUsers(): FarmerProfile[] {
  try {
    const raw = localStorage.getItem(ALL_USERS_KEY);
    return raw ? (JSON.parse(raw) as FarmerProfile[]) : [];
  } catch {
    return [];
  }
}

function persistAllUsers(users: FarmerProfile[]): void {
  localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
}

function persistCurrentUser(user: FarmerProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarmerProfile | null>(loadUser);

  // Sync user state changes back into both stores
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    persistCurrentUser(user);
    // Keep the all-users list up-to-date (e.g. after saveEstimate)
    const users = loadAllUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    persistAllUsers(users);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const users = loadAllUsers();
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!match) {
      throw new Error("Invalid email or password.");
    }
    setUser(match);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const users = loadAllUsers();
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error("An account with that email already exists.");
    }
    const newUser: FarmerProfile = {
      id: `farmer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      password,
      farms: [],
      savedEstimates: [],
    };
    users.push(newUser);
    persistAllUsers(users);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const saveEstimate = useCallback(
    (estimate: Omit<SavedEstimate, "id" | "savedAt">) => {
      setUser((prev) => {
        if (!prev) return prev;
        const newEstimate: SavedEstimate = {
          ...estimate,
          id: `est_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          savedEstimates: [newEstimate, ...prev.savedEstimates],
        };
      });
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, saveEstimate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
