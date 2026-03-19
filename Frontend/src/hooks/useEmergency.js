import { useState } from "react";
import { submitIncidentReport } from "../services/emergencyService.js";

export function useEmergency() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submitReport(incidentData) {
    setLoading(true);
    setError(null);
    try {
      const data = await submitIncidentReport(incidentData);
      setReport(data);
      return data;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { report, loading, error, submitReport };
}
