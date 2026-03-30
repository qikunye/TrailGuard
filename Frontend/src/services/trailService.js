import { API_BASE } from "../config/constants.js";
import { kongFetch } from "../lib/kongClient.js";

/**
 * GET /trails/search?q=...
 */
export async function searchTrails(query) {
  const res = await kongFetch(`${API_BASE}/trails/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Trail search failed");
  return res.json();
}

/**
 * POST /trail-registration  — registers a hiker for a trail (nearby users DB)
 */
export async function registerForTrail(data) {
  const res = await kongFetch(`${API_BASE}/trail-registration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Trail registration failed");
  return res.json();
}
