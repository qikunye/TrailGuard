import { useState } from "react";
import { getTrailAssessment } from "../services/assessmentService.js";

export function useAssessment() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function assess(trailData) {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrailAssessment(trailData);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, error, assess };
}
