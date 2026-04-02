"""
TRAILGUARD – Alternative Route Service  (Composite / Orchestrator)
Port: 8009

Triggered by Report Ingestion Service when a hazard is reported.

Flow:
  POST /alternative-route
    ← Report Ingestion Service sends: {hikerId, trailId, hazardLat, hazardLng, currentLat, currentLng}

  1. Fetch the affected trail's start/end from Trail Condition Service
  2. Request OSRM walking routes with alternatives=true (same start → same end)
  3. The first route is the "original" (shortest / default)
  4. Pick the alternative that is farthest from the hazard point
  5. Return both routes with full paths, distances, and ETAs
"""

import os
import logging
import math
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("AlternativeRouteService")

app = FastAPI(
    title="TRAILGUARD – Alternative Route Service",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service URLs ──────────────────────────────────────────────────────────────
TRAIL_CONDITION_URL  = os.getenv("TRAIL_CONDITION_URL",  "http://localhost:8002")
GOOGLEMAPS_URL       = os.getenv("GOOGLEMAPS_URL",       "http://localhost:8007")
REPORT_INGESTION_URL = os.getenv("REPORT_INGESTION_URL", "http://localhost:8010")

OSRM_BASE = "https://router.project-osrm.org"
TIMEOUT   = httpx.Timeout(15.0, connect=5.0)


# ── Schemas ───────────────────────────────────────────────────────────────────

class AlternativeRouteRequest(BaseModel):
    hikerId:    str   = Field(..., example="usr_001")
    trailId:    str   = Field(..., example="2")
    mountainId: str   = Field("sg", example="sg")
    hazardLat:  float = Field(..., example=1.3500)
    hazardLng:  float = Field(..., example=103.8200)
    currentLat: float = Field(..., example=1.3442)
    currentLng: float = Field(..., example=103.8197)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2):
    """Haversine distance in metres."""
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dLng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _min_dist_to_path(lat, lng, path):
    """Minimum haversine distance from a point to any point on a path."""
    if not path:
        return float("inf")
    return min(_haversine(lat, lng, p[0], p[1]) for p in path)


async def _get(client: httpx.AsyncClient, url: str) -> dict:
    try:
        resp = await client.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        log.error("HTTP error from %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.status_code}")
    except httpx.RequestError as e:
        log.error("Connection error to %s: %s", url, e)
        raise HTTPException(status_code=503, detail=f"Cannot reach {url}")


async def _post(client: httpx.AsyncClient, url: str, payload: dict) -> dict:
    try:
        resp = await client.post(url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        log.error("HTTP error from %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.status_code}")
    except httpx.RequestError as e:
        log.error("Connection error to %s: %s", url, e)
        raise HTTPException(status_code=503, detail=f"Cannot reach {url}")


async def _osrm_alternatives(client, s_lat, s_lng, e_lat, e_lng):
    """Fetch multiple walking routes from OSRM between the same two points."""
    url = (
        f"{OSRM_BASE}/route/v1/foot/"
        f"{s_lng},{s_lat};{e_lng},{e_lat}"
        f"?overview=full&geometries=geojson&alternatives=3"
    )
    try:
        resp = await client.get(url, timeout=TIMEOUT)
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return []
        results = []
        for route in data["routes"]:
            coords = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
            results.append({
                "path":            coords,
                "distanceMetres":  route["distance"],
                "durationSeconds": route["duration"],
            })
        return results
    except Exception as e:
        log.warning("OSRM alternatives failed: %s", e)
        return []


async def _osrm_via_route(client, s_lat, s_lng, via_lat, via_lng, e_lat, e_lng):
    """Fetch a walking route that passes through a via-waypoint (to force a detour)."""
    url = (
        f"{OSRM_BASE}/route/v1/foot/"
        f"{s_lng},{s_lat};{via_lng},{via_lat};{e_lng},{e_lat}"
        f"?overview=full&geometries=geojson"
    )
    try:
        resp = await client.get(url, timeout=TIMEOUT)
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        route = data["routes"][0]
        coords = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
        return {
            "path":            coords,
            "distanceMetres":  route["distance"],
            "durationSeconds": route["duration"],
        }
    except Exception as e:
        log.warning("OSRM via-route failed: %s", e)
        return None


def _compute_detour_point(s_lat, s_lng, e_lat, e_lng, hazard_lat, hazard_lng):
    """
    Compute a waypoint that is offset from the trail midpoint, away from the hazard.
    This forces OSRM to route around the hazard side.
    """
    mid_lat = (s_lat + e_lat) / 2
    mid_lng = (s_lng + e_lng) / 2

    # Vector from hazard to midpoint
    dlat = mid_lat - hazard_lat
    dlng = mid_lng - hazard_lng
    length = math.sqrt(dlat ** 2 + dlng ** 2)

    if length < 1e-7:
        # Hazard is at midpoint — offset perpendicular to the trail direction
        trail_dlat = e_lat - s_lat
        trail_dlng = e_lng - s_lng
        perp_lat = -trail_dlng
        perp_lng = trail_dlat
        plength = math.sqrt(perp_lat ** 2 + perp_lng ** 2)
        if plength < 1e-7:
            return mid_lat + 0.012, mid_lng + 0.012
        offset = 0.015
        return mid_lat + offset * perp_lat / plength, mid_lng + offset * perp_lng / plength

    # Push the waypoint away from the hazard (0.015° ≈ 1.5km in SG)
    offset = 0.015
    return mid_lat + offset * dlat / length, mid_lng + offset * dlng / length


def _fmt_distance(metres):
    if metres >= 1000:
        return f"{metres / 1000:.1f} km"
    return f"{round(metres)} m"


def _fmt_duration(seconds):
    if seconds >= 3600:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h} hr {m} min"
    return f"{int(seconds // 60)} min"


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/alternative-route", tags=["Alternative Route"])
async def get_alternative_route(req: AlternativeRouteRequest):
    """
    Computes an alternative walking route on the SAME trail (same start & end)
    that avoids the reported hazard location.
    """
    log.info(
        "▶ Alternative route request | trailId=%s hazard=(%s,%s)",
        req.trailId, req.hazardLat, req.hazardLng,
    )

    async with httpx.AsyncClient() as client:

        # ── 1. Fetch trail start/end from Trail Condition Service ─────────────
        log.info("Step 1 – Fetching trail info for trailId=%s", req.trailId)
        try:
            trail = await _get(client, f"{TRAIL_CONDITION_URL}/trail/{req.trailId}/conditions")
        except HTTPException:
            raise HTTPException(status_code=404, detail=f"Trail '{req.trailId}' not found.")

        if not trail.get("startPoint") or not trail.get("endPoint"):
            raise HTTPException(status_code=502, detail="Trail is missing start/end coordinates.")

        sp = trail["startPoint"].split(",")
        ep = trail["endPoint"].split(",")
        s_lat, s_lng = float(sp[0].strip()), float(sp[1].strip())
        e_lat, e_lng = float(ep[0].strip()), float(ep[1].strip())
        trail_name = trail.get("name", f"Trail #{req.trailId}")
        trail_difficulty = trail.get("difficulty", "")

        log.info("Trail: %s | start=(%s,%s) end=(%s,%s)", trail_name, s_lat, s_lng, e_lat, e_lng)

        # ── 2. Get multiple routes from OSRM ─────────────────────────────────
        log.info("Step 2 – Requesting OSRM alternative routes")
        routes = await _osrm_alternatives(client, s_lat, s_lng, e_lat, e_lng)
        log.info("OSRM returned %d route(s)", len(routes))

        # ── 3. Also compute a via-waypoint route that detours around hazard ───
        via_lat, via_lng = _compute_detour_point(s_lat, s_lng, e_lat, e_lng, req.hazardLat, req.hazardLng)
        log.info("Step 3 – Computing via-waypoint detour through (%s,%s)", round(via_lat, 5), round(via_lng, 5))
        via_route = await _osrm_via_route(client, s_lat, s_lng, via_lat, via_lng, e_lat, e_lng)
        if via_route:
            routes.append(via_route)
            log.info("Via-route added: %s, %s",
                     _fmt_distance(via_route["distanceMetres"]),
                     _fmt_duration(via_route["durationSeconds"]))

        if len(routes) < 1:
            raise HTTPException(status_code=404, detail="OSRM could not compute any route for this trail.")

        # ── 4. Original = first route; Alternative = farthest from hazard ─────
        original_route = routes[0]

        if len(routes) >= 2:
            # Score each candidate by minimum distance from hazard
            scored = []
            for i, r in enumerate(routes[1:], start=1):
                min_d = _min_dist_to_path(req.hazardLat, req.hazardLng, r["path"])
                scored.append((min_d, i, r))
            scored.sort(key=lambda x: -x[0])  # farthest first
            alt_route = scored[0][2]
            log.info("Picked alternative route #%d (min hazard dist: %dm, dist: %s)",
                     scored[0][1], round(scored[0][0]),
                     _fmt_distance(alt_route["distanceMetres"]))
        else:
            # Only one route returned — use via-waypoint fallback
            alt_route = original_route
            log.warning("Only 1 route available — alternative = original")

        # ── 5. POST recommendation to Report Ingestion ────────────────────────
        recommendation_payload = {
            "hikerId":                 req.hikerId,
            "originalTrailId":         req.trailId,
            "mountainId":              req.mountainId,
            "hazardType":              "hazard",
            "severity":                1,
            "recommendedTrailId":      req.trailId,
            "recommendedTrailName":    trail_name,
            "routeDistanceMeters":     alt_route["distanceMetres"],
            "estimatedTravelTimeMins": alt_route["durationSeconds"] / 60,
            "timestamp":               datetime.utcnow().isoformat() + "Z",
        }
        try:
            await _post(client, f"{REPORT_INGESTION_URL}/update-recommendation", recommendation_payload)
            log.info("Step 5 ✓ Recommendation posted")
        except HTTPException as e:
            log.warning("Step 5 ✗ Could not notify Report Ingestion (non-fatal): %s", e.detail)

    # ── Build response for UI ─────────────────────────────────────────────────
    response = {
        "status": "ok",

        "trailId":         req.trailId,
        "trailName":       trail_name,
        "trailDifficulty": trail_difficulty,

        "startLat": s_lat, "startLng": s_lng,
        "endLat":   e_lat, "endLng":   e_lng,

        "originalRoute": {
            "path":            original_route["path"],
            "distanceMetres":  original_route["distanceMetres"],
            "durationSeconds": original_route["durationSeconds"],
            "distanceText":    _fmt_distance(original_route["distanceMetres"]),
            "durationText":    _fmt_duration(original_route["durationSeconds"]),
        },

        "alternativeRoute": {
            "path":            alt_route["path"],
            "distanceMetres":  alt_route["distanceMetres"],
            "durationSeconds": alt_route["durationSeconds"],
            "distanceText":    _fmt_distance(alt_route["distanceMetres"]),
            "durationText":    _fmt_duration(alt_route["durationSeconds"]),
        },

        "hazardLat": req.hazardLat,
        "hazardLng": req.hazardLng,

        "timeCreated": datetime.utcnow().isoformat() + "Z",
    }

    log.info(
        "◀ Done | original=%s alt=%s",
        _fmt_distance(original_route["distanceMetres"]),
        _fmt_distance(alt_route["distanceMetres"]),
    )
    return response


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Alternative_Route_Service"}


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "Alternative_Route_Service:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8009)),
        reload=True,
    )
