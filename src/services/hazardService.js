import { API_BASE } from "../config/constants.js";

/**
 * POST /report-ingestion
 * @param {{ trailId: string, hazardType: string, description: string, location: object, photoUrl?: string }} data
 */
export async function submitHazardReport(data) {
  const res = await fetch(`${API_BASE}/report-ingestion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Hazard report submission failed");
  return res.json();
}

/**
 * GET /alternative-routes?trailId=...
 */
export async function getAlternativeRoutes(trailId) {
  const res = await fetch(`${API_BASE}/alternative-routes?trailId=${trailId}`);
  if (!res.ok) throw new Error("Failed to fetch alternative routes");
  return res.json();
}
