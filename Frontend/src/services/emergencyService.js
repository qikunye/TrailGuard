import { kongFetch } from "../lib/kongClient.js";

const INCIDENT_BASE = import.meta.env.VITE_INCIDENT_URL ?? "http://localhost:8080/api/incident";

/**
 * POST /incident-reporting
 * Calls the Incident Reporting composite service (Scenario 2).
 * @param {{
 *   userId: number,
 *   hikerPhone: string,
 *   trailId: number,
 *   severity: number,
 *   injuryType: string,
 *   description: string,
 *   lat: number,
 *   lng: number,
 *   photoUrl?: string
 * }} data
 */
export async function submitIncidentReport(data) {
  const res = await kongFetch(`${INCIDENT_BASE}/incident-reporting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Incident report submission failed");
  return res.json();
}
