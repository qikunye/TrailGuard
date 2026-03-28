"""
TRAILGUARD – Alternative Route Service  (Composite / Orchestrator)
Port: 8009

Triggered by Report Ingestion Service when operationalStatus is CAUTION or CLOSED.

Flow:
  POST /alternative-route
    ← Report Ingestion Service sends: {trailId, mountainId, hazardLat, hazardLng, currentLat, currentLng}

  Step 5A – Retrieve Candidate Trails
    POST /trails/candidates → Trail Condition Service
    sends:   {mountainId, excludeTrailId, requiredOperationalStatus}
    returns: {candidateTrails}

  Step 5B – Compute Alternative Route
    POST /route/alternative → Google Maps Wrapper
    sends:   {currentLat, currentLng, hazardLat, hazardLng, candidateTrailHeads}
    returns: {alternativeTrailId, routeDistanceMeters, estimatedTravelTimeMins}

  → Returns final result to Report Ingestion Service (and UI)
"""

import os
import logging
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("AlternativeRouteService")

app = FastAPI(
    title="TRAILGUARD – Alternative Route Service",
    version="1.0.0",
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
GOOGLEMAPS_URL         = os.getenv("GOOGLEMAPS_URL",         "http://localhost:8007")
REPORT_INGESTION_URL   = os.getenv("REPORT_INGESTION_URL",   "http://localhost:8010")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)


# ── Schemas ───────────────────────────────────────────────────────────────────

class AlternativeRouteRequest(BaseModel):
    hikerId:    str   = Field(..., example="usr_001")
    trailId:    str   = Field(..., example="trail_mt_kinabalu")
    mountainId: str   = Field(..., example="mountain_kinabalu")
    hazardLat:  float = Field(..., example=6.0750)
    hazardLng:  float = Field(..., example=116.5625)
    currentLat: float = Field(..., example=6.0720)
    currentLng: float = Field(..., example=116.5600)


# ── Helpers ───────────────────────────────────────────────────────────────────

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


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/alternative-route", tags=["Alternative Route"])
async def get_alternative_route(req: AlternativeRouteRequest):
    """
    Called by Report Ingestion Service when a trail's operationalStatus
    is CAUTION or CLOSED. Returns the best alternative trail and navigation route.
    """
    log.info(
        "▶ Alternative route request | trailId=%s mountainId=%s hazard=(%s,%s) current=(%s,%s)",
        req.trailId, req.mountainId, req.hazardLat, req.hazardLng,
        req.currentLat, req.currentLng,
    )

    async with httpx.AsyncClient() as client:

        # ── Step 5A: Get candidate trails from Trail Condition Service ─────────
        log.info("Step 5A – Fetching candidate trails from Trail Condition Service")

        candidates_payload = {
            "mountainId":              req.mountainId,
            "excludeTrailId":          req.trailId,
            "requiredOperationalStatus": "OPEN",
        }
        candidates_result = await _post(
            client,
            f"{TRAIL_CONDITION_URL}/trails/candidates",
            candidates_payload,
        )

        candidate_trails: list[dict] = candidates_result.get("candidateTrails", [])

        if not candidate_trails:
            raise HTTPException(
                status_code=404,
                detail=f"No safe alternative trails found on mountain '{req.mountainId}'.",
            )

        log.info("Step 5A ✓ candidateCount=%d", len(candidate_trails))

        # Build trailhead list for Google Maps — each candidate needs a lat/lng entry
        candidate_trail_heads = [
            {
                "trailId":    t["trailId"],
                "trailName":  t.get("name", t["trailId"]),
                "lat":        t["trailHeadLat"],
                "lng":        t["trailHeadLng"],
            }
            for t in candidate_trails
            if "trailHeadLat" in t and "trailHeadLng" in t
        ]

        if not candidate_trail_heads:
            raise HTTPException(
                status_code=502,
                detail="Candidate trails returned by Trail Condition Service are missing trailhead coordinates.",
            )

        # ── Step 5B: Compute best route via Google Maps Wrapper ───────────────
        log.info(
            "Step 5B – Computing alternative routes via Google Maps Wrapper | candidates=%d",
            len(candidate_trail_heads),
        )

        maps_payload = {
            "currentLat":         req.currentLat,
            "currentLng":         req.currentLng,
            "hazardLat":          req.hazardLat,
            "hazardLng":          req.hazardLng,
            "candidateTrailHeads": candidate_trail_heads,
        }
        maps_result = await _post(
            client,
            f"{GOOGLEMAPS_URL}/route/alternative",
            maps_payload,
        )

        alternative_trail_id       = maps_result.get("alternativeTrailId")
        route_distance_meters      = maps_result.get("routeDistanceMeters")
        estimated_travel_time_mins = maps_result.get("estimatedTravelTimeMins")

        log.info(
            "Step 5B ✓ alternativeTrailId=%s distanceMeters=%s travelTimeMins=%s",
            alternative_trail_id, route_distance_meters, estimated_travel_time_mins,
        )

        # ── Step 6: POST recommendation back to Report Ingestion Service ──────
        log.info("Step 6 – Reporting best alternative back to Report Ingestion Service")
        recommendation_payload = {
            "hikerId":                 req.hikerId,
            "originalTrailId":         req.trailId,
            "mountainId":              req.mountainId,
            "hazardType":              "hazard",
            "severity":                1,
            "recommendedTrailId":      alternative_trail_id,
            "recommendedTrailName":    next(
                (t["trailName"] for t in candidate_trail_heads if t["trailId"] == alternative_trail_id),
                alternative_trail_id,
            ),
            "routeDistanceMeters":     route_distance_meters,
            "estimatedTravelTimeMins": estimated_travel_time_mins,
            "timestamp":               datetime.utcnow().isoformat() + "Z",
        }
        try:
            await _post(client, f"{REPORT_INGESTION_URL}/update-recommendation", recommendation_payload)
            log.info("Step 6 ✓ Recommendation posted to Report Ingestion Service")
        except HTTPException as e:
            log.warning("Step 6 ✗ Could not notify Report Ingestion Service (non-fatal): %s", e.detail)

    # ── Return result ─────────────────────────────────────────────────────────
    response = {
        "status":                  "ok",
        "originalTrailId":         req.trailId,
        "mountainId":              req.mountainId,
        "alternativeTrailId":      alternative_trail_id,
        "routeDistanceMeters":     route_distance_meters,
        "estimatedTravelTimeMins": estimated_travel_time_mins,
        "timeCreated":             datetime.utcnow().isoformat() + "Z",
    }

    log.info(
        "◀ Alternative route resolved | alternativeTrailId=%s distanceMeters=%s travelTimeMins=%s",
        alternative_trail_id, route_distance_meters, estimated_travel_time_mins,
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