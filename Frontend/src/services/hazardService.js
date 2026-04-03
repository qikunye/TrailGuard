import { kongFetch } from "../lib/kongClient.js";

const HAZARD_REPORT_URL = import.meta.env.VITE_HAZARD_REPORT_URL ?? "http://localhost:8080/api/hazard-report";
const ALT_ROUTE_URL     = import.meta.env.VITE_ALT_ROUTE_URL     ?? "http://localhost:8080/api/alt-route";

/**
 * POST /report-hazard  →  Report Ingestion Service (port 8010)
 */
export async function submitHazardReport(data) {
  const res = await kongFetch(`${HAZARD_REPORT_URL}/report-hazard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Hazard report submission failed");
  return res.json();
}

/**
 * GET /hazards  →  Report Ingestion Service (port 8010)
 * Returns all hazard reports from all users.
 */
export async function getAllHazards() {
  const res = await kongFetch(`${HAZARD_REPORT_URL}/hazards`);
  if (!res.ok) throw new Error("Failed to fetch hazards");
  return res.json();
}

/**
 * POST /alternative-route  →  Alternative Route Service (port 8009)
 */
export async function getAlternativeRoutes(data) {
  const res = await kongFetch(`${ALT_ROUTE_URL}/alternative-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to fetch alternative routes");
  return res.json();
}
