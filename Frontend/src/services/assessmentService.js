import { API_BASE } from "../config/constants.js";

/**
 * POST /trail-safety-assessment
 * @param {{ trailId: string, trailName: string, date: string, partySize: number }} trailData
 */
export async function getTrailAssessment(trailData) {
  const res = await fetch(`${API_BASE}/trail-safety-assessment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trailData),
  });
  if (!res.ok) throw new Error("Assessment request failed");
  return res.json();
}
