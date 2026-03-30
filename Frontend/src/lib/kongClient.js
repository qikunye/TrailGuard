/**
 * kongClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central fetch wrapper that automatically injects the Kong X-API-Key header
 * on every request to a backend service URL.
 *
 * Usage:
 *   import { kongFetch } from "../lib/kongClient.js";
 *   const res = await kongFetch(`${ORCHESTRATOR_URL}/assess-trail`, { method: "POST", body: ... });
 *
 * External URLs (Google Maps API, Open-Meteo, Firebase) are passed through
 * unchanged — they do NOT go through Kong and don't need the key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KONG_API_KEY = import.meta.env.VITE_KONG_API_KEY ?? "tg-dev-key-local-only";
const KONG_BASE    = import.meta.env.VITE_KONG_BASE_URL ?? "http://localhost:8080";

/**
 * Returns true if this URL should have the Kong API key injected.
 * We inject the key on any request to our own Kong proxy (localhost:8080
 * or any /api/* relative path), but NOT on third-party URLs.
 */
function isKongRequest(url) {
  if (!url) return false;
  // Relative paths starting with /api/ always go through Kong
  if (url.startsWith("/api/")) return true;
  // Absolute URLs pointing at our Kong proxy
  if (url.startsWith(KONG_BASE)) return true;
  // Also catch localhost:8080 even if KONG_BASE differs
  if (url.includes("localhost:8080")) return true;
  return false;
}

/**
 * Drop-in replacement for `fetch()` that injects X-API-Key when calling Kong.
 * All other options (method, body, headers, etc.) are passed through unchanged.
 */
export async function kongFetch(url, options = {}) {
  if (isKongRequest(url)) {
    const existingHeaders = options.headers || {};
    options = {
      ...options,
      headers: {
        ...existingHeaders,
        "X-API-Key": KONG_API_KEY,
      },
    };
  }
  return fetch(url, options);
}
