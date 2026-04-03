import { useState } from "react";
import { api } from "../services/api";
import type { FarmInput, MRVResult } from "../types";

export function useMRV() {
  const [result, setResult] = useState<MRVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (farm: FarmInput) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.calculateMRV(farm);
      setResult(data);
      return data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Calculation failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const verifySatellite = async (farm: FarmInput, lat?: number, lng?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.verifySatellite(farm, lat, lng);
      setResult(data);
      return data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Satellite verification failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { result, loading, error, calculate, verifySatellite, reset };
}
