/**
 * Calls POST /assess-trail on the Orchestrator (port 8000).
 *
 * Required payload fields (all validated by the orchestrator):
 *   userId           – hiker's registered userId
 *   trailId          – trail identifier (must exist in mock DB)
 *   plannedDate      – "YYYY-MM-DD"
 *   plannedStartTime – "HH:MM"
 *   declaredExpLevel – "beginner" | "intermediate" | "advanced"
 *
 * Old /trail-safety-assessment route (unused) has been removed.
 */
const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

export async function getTrailAssessment({ userId, trailId, plannedDate, plannedStartTime, declaredExpLevel }) {
  const res = await fetch(`${ORCHESTRATOR_URL}/assess-trail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, trailId, plannedDate, plannedStartTime, declaredExpLevel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Assessment failed (HTTP ${res.status})`);
  }
  return res.json();
}
