import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { FarmInput, MRVResult, KGMLStatus } from "../types";

export function useMRV() {
  const [result, setResult] = useState<MRVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kgmlStatus, setKgmlStatus] = useState<KGMLStatus | null>(null);

  // Check KGML/GEE availability on mount
  useEffect(() => {
    api.getKGMLStatus().then(setKgmlStatus).catch(() => {});
  }, []);

  const extractError = (err: unknown): string => {
    return (
      (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail ?? "Calculation failed"
    );
  };

  /** Basic IPCC-only calculation */
  const calculate = async (farm: FarmInput) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.calculateMRV(farm);
      setResult(data);
      return data;
    } catch (err: unknown) {
      setError(extractError(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** Primary: IPCC + GEE + KGML ensemble (5-step pipeline) */
  const calculateKGML = async (
    farm: FarmInput,
    lat?: number,
    lng?: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.calculateKGML(farm, lat, lng);
      setResult(data);
      return data;
    } catch (err: unknown) {
      setError(extractError(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** Satellite-only verification */
  const verifySatellite = async (
    farm: FarmInput,
    lat?: number,
    lng?: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.verifySatellite(farm, lat, lng);
      setResult(data);
      return data;
    } catch (err: unknown) {
      setError(extractError(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    result,
    loading,
    error,
    kgmlStatus,
    calculate,
    calculateKGML,
    verifySatellite,
    reset,
  };
}
