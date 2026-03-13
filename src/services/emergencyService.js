import { API_BASE } from "../config/constants.js";

/**
 * POST /incident-reporting
 * @param {{ trailId: string, severity: number, injuryType: string, location: object, photoUrl?: string }} data
 */
export async function submitIncidentReport(data) {
  const res = await fetch(`${API_BASE}/incident-reporting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Incident report submission failed");
  return res.json();
}
