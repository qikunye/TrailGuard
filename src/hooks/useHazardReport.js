import { useState } from "react";
import { submitHazardReport } from "../services/hazardService.js";

export function useHazardReport() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submitReport(hazardData) {
    setLoading(true);
    setError(null);
    try {
      const data = await submitHazardReport(hazardData);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, error, submitReport };
}
