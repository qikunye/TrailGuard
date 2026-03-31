import { API_BASE } from "../config/constants.js";
import { kongFetch } from "../lib/kongClient.js";

/**
 * GET /hiker-profile?uid=...
 */
export async function getProfile(uid) {
  const res = await kongFetch(`${API_BASE}/hiker-profile?uid=${uid}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

/**
 * POST /hiker-profile
 */
export async function saveProfile(profileData) {
  const res = await kongFetch(`${API_BASE}/hiker-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}
