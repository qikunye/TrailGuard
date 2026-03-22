const INCIDENT_BASE = import.meta.env.VITE_INCIDENT_URL ?? "http://localhost:8007";

/**
 * POST /incident-reporting
 * Calls the Incident Reporting composite service, which fetches the hiker's
 * emergency contacts and forwards the SMS request to the Notification Wrapper.
 * @param {{ hikerId: string, trailId: string, severity: number, injuryType: string, location: object, photoUrl?: string }} data
 */
export async function submitIncidentReport(data) {
  const res = await fetch(`${INCIDENT_BASE}/incident-reporting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Incident report submission failed");
  return res.json();
}
