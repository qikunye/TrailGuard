"""
TRAILGUARD – Report Ingestion Service  (Composite / Orchestrator)
Port: 8010

Entry point for Scenario 3 – Hazard Report & Rerouting.

Flow:
  POST /report-hazard
    ← UI sends: {hikerId, trailId, mountainId, hazardType, severity,
                 hazardLat, hazardLng, currentLat, currentLng, description, photoUrl}

  Step 1 – Persist hazard report
    Stores the hazard in the in-memory hazard store (DB in production).

  Step 2 – Get trail operational status
    GET /trail/{trailId}/conditions → Trail Condition Service
    Returns current operationalStatus for the trail.

  Step 3 – Notify active hikers on trail
    POST /broadcast → Notification Wrapper (SMS broadcast to all isHiking=True hikers)

  Step 15 – Update trail condition based on reported severity
    POST /trail/{trailId}/update-condition → Trail Condition Service
    severity 4–5 → CLOSED, severity 2–3 → CAUTION, severity 1 → unchanged

  Step 4 – Trigger rerouting if status is CAUTION or CLOSED
    POST /alternative-route → Alternative Route Composite Service
    sends:   {trailId, mountainId, hazardLat, hazardLng, currentLat, currentLng}
    returns: {alternativeTrailId, routeDistanceMeters, estimatedTravelTimeMins}

  Step 5 – Receive rerouting result (POST /update-recommendation)
    ← Alternative Route Service reports back the best alternative.

  → Returns full hazard + rerouting result to UI
"""

import os
import logging
from datetime import datetime
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ReportIngestionService")

app = FastAPI(
    title="TRAILGUARD – Report Ingestion Service",
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
TRAIL_CONDITION_URL    = os.getenv("TRAIL_CONDITION_URL",    "http://localhost:8002")
NOTIFICATION_URL       = os.getenv("NOTIFICATION_URL",       "http://localhost:5050")
ALTERNATIVE_ROUTE_URL  = os.getenv("ALTERNATIVE_ROUTE_URL",  "http://localhost:8009")
NEARBY_USERS_URL       = os.getenv("NEARBY_USERS_URL",       "http://localhost:5005")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# ── In-memory hazard store (replace with DB in production) ───────────────────
HAZARD_STORE: dict[str, dict] = {}

# ── Operational statuses that trigger rerouting ───────────────────────────────
REROUTE_STATUSES = {"CAUTION", "CLOSED"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class HazardReport(BaseModel):
    model_config = {"extra": "ignore"}

    hikerId:     str   = Field(...,  example="usr_001")
    trailId:     str   = Field(...,  example="trail_mt_kinabalu")
    mountainId:  str   = Field(...,  example="mountain_kinabalu")
    hazardType:  str   = Field(...,  example="landslide")
    severity:    int   = Field(...,  ge=1, le=5)
    hazardLat:   float = Field(...,  example=6.0750)
    hazardLng:   float = Field(...,  example=116.5625)
    currentLat:  float = Field(...,  example=6.0720)
    currentLng:  float = Field(...,  example=116.5600)
    description: str   = Field("",  example="Large rockfall blocking the main path")
    photoUrl:    str | None = None

class RecommendationUpdate(BaseModel):
    hikerId:              str
    originalTrailId:      str
    mountainId:           str
    hazardType:           str
    severity:             int
    recommendedTrailId:   str
    recommendedTrailName: str
    routeDistanceMeters:  float
    estimatedTravelTimeMins: float
    timestamp:            str


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def _build_broadcast_message(report: HazardReport, operational_status: str) -> str:
    return (
        f"TRAIL ALERT: {report.hazardType} reported on trail {report.trailId}. "
        f"Status: {operational_status}. Severity: {report.severity}/5. "
        f"Description: {report.description or 'No additional details.'}. "
        f"Location: ({report.hazardLat:.5f}, {report.hazardLng:.5f}). "
        f"Please proceed with caution or exit the trail safely."
    )


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/report-hazard", tags=["Hazard Report"])
async def report_hazard(report: HazardReport):
    """
    Entry point for Scenario 3. Ingests a hazard report from the UI,
    checks trail status, notifies active hikers, and triggers rerouting
    if the trail is CAUTION or CLOSED.
    """
    hazard_id = f"HAZ-{report.trailId}-{uuid4().hex[:8].upper()}"
    log.info(
        "▶ Hazard report received | hazardId=%s hikerId=%s trailId=%s hazardType=%s severity=%s",
        hazard_id, report.hikerId, report.trailId, report.hazardType, report.severity,
    )

    rerouting_result = None

    async with httpx.AsyncClient() as client:

        # ── Step 1: Persist hazard report ─────────────────────────────────────
        hazard_record = {
            "hazardId":    hazard_id,
            "hikerId":     report.hikerId,
            "trailId":     report.trailId,
            "mountainId":  report.mountainId,
            "hazardType":  report.hazardType,
            "severity":    report.severity,
            "hazardLat":   report.hazardLat,
            "hazardLng":   report.hazardLng,
            "currentLat":  report.currentLat,
            "currentLng":  report.currentLng,
            "description": report.description,
            "photoUrl":    report.photoUrl,
            "reportedAt":  datetime.utcnow().isoformat() + "Z",
            "status":      "ACTIVE",
        }
        HAZARD_STORE[hazard_id] = hazard_record
        log.info("Step 1 ✓ Hazard persisted | hazardId=%s", hazard_id)

        # ── Step 2: Get trail operational status + name ───────────────────────
        log.info("Step 2 – Fetching trail conditions for trailId=%s", report.trailId)
        trail_name = f"Trail #{report.trailId}"
        try:
            conditions = await _get(
                client,
                f"{TRAIL_CONDITION_URL}/trail/{report.trailId}/conditions",
            )
            operational_status = conditions.get("operationalStatus", "OPEN")
            trail_name = conditions.get("name", trail_name)
        except HTTPException:
            log.warning("Trail Condition Service unavailable — defaulting to CAUTION")
            operational_status = "CAUTION"

        # Update hazard record with the trail's current status
        HAZARD_STORE[hazard_id]["operationalStatus"] = operational_status
        log.info("Step 2 ✓ operationalStatus=%s trailName=%s", operational_status, trail_name)

        # ── Step 3: Fetch active hikers on the trail, then broadcast ─────────
        log.info("Step 3 – Fetching nearby users for trailId=%s", report.trailId)
        nearby_user_ids: list[int] = []
        try:
            nearby_data = await _get(client, f"{NEARBY_USERS_URL}/getNearby/{report.trailId}")
            nearby_user_ids = nearby_data.get("nearbyUserIds", [])
            log.info("Step 3 – Found %d active hikers on trail", len(nearby_user_ids))
        except HTTPException:
            log.warning("Step 3 – Nearby Users Service unavailable")

        log.info("Step 3 – Broadcasting hazard alert to %d hikers", len(nearby_user_ids))
        broadcast_payload = {
            "userIds":           nearby_user_ids,
            "phones":            [],   # phones resolved from Telegram registry in notification wrapper
            "trailId":           report.trailId,
            "trailName":         trail_name,
            "operationalStatus": operational_status,
            "hazardType":        report.hazardType,
            "severity":          report.severity,
        }
        try:
            await _post(client, f"{NOTIFICATION_URL}/broadcast", broadcast_payload)
            log.info("Step 3 ✓ Broadcast sent to %d hikers", len(nearby_user_ids))
        except HTTPException as e:
            log.warning("Step 3 ✗ Broadcast failed (non-fatal): %s", e.detail)

        # ── Step 15: Update trail condition based on reported severity ───────
        log.info("Step 15 – Updating trail condition for trailId=%s", report.trailId)
        severity_to_status = {5: "CLOSED", 4: "CLOSED", 3: "CAUTION", 2: "CAUTION"}
        new_trail_status = severity_to_status.get(report.severity, operational_status)
        update_condition_payload = {
            "operationalStatus":    new_trail_status,
            "highestSeverityActive": str(report.severity),
            "hazardCountActive":    1,
            "hazardType":           report.hazardType,
            "location":             f"{report.hazardLat:.5f}, {report.hazardLng:.5f}",
            "updatedAt":            datetime.utcnow().isoformat() + "Z",
        }
        try:
            await _post(
                client,
                f"{TRAIL_CONDITION_URL}/trail/{report.trailId}/update-condition",
                update_condition_payload,
            )
            operational_status = new_trail_status
            HAZARD_STORE[hazard_id]["operationalStatus"] = operational_status
            log.info("Step 15 ✓ Trail condition updated → %s", operational_status)
        except HTTPException as e:
            log.warning("Step 15 ✗ Trail condition update failed (non-fatal): %s", e.detail)

        # ── Step 4: Always trigger rerouting when a hazard is reported ─────
        # A new hazard report means conditions have changed, regardless of
        # the trail's current DB status. Always offer an alternative route.
        log.info(
            "Step 4 – Triggering rerouting | operationalStatus=%s → POST /alternative-route",
            operational_status,
        )
        reroute_payload = {
            "hikerId":    report.hikerId,
            "trailId":    report.trailId,
            "mountainId": report.mountainId,
            "hazardLat":  report.hazardLat,
            "hazardLng":  report.hazardLng,
            "currentLat": report.currentLat,
            "currentLng": report.currentLng,
        }
        try:
            rerouting_result = await _post(
                client,
                f"{ALTERNATIVE_ROUTE_URL}/alternative-route",
                reroute_payload,
            )
            log.info(
                "Step 4 ✓ Rerouting complete | alternativeTrailId=%s distanceM=%s travelTimeMins=%s",
                rerouting_result.get("alternativeTrailId"),
                rerouting_result.get("routeDistanceMeters"),
                rerouting_result.get("estimatedTravelTimeMins"),
            )
        except HTTPException as e:
            log.error("Step 4 ✗ Rerouting failed: %s", e.detail)
            rerouting_result = {"status": "FAILED", "error": e.detail}

    # ── Build and return response to UI ───────────────────────────────────────
    response = {
        "status":            "ingested",
        "hazardId":          hazard_id,
        "hikerId":           report.hikerId,
        "trailId":           report.trailId,
        "mountainId":        report.mountainId,
        "hazardType":        report.hazardType,
        "severity":          report.severity,
        "operationalStatus": operational_status,
        "reroutingTriggered": True,
        "reroutingResult":   rerouting_result,
        "reportedAt":        hazard_record["reportedAt"],
    }

    log.info(
        "◀ Hazard ingested | hazardId=%s operationalStatus=%s reroutingTriggered=%s",
        hazard_id, operational_status, operational_status in REROUTE_STATUSES,
    )
    return response


# ── Receive rerouting recommendation from Alternative Route Service ───────────

@app.post("/update-recommendation", tags=["Hazard Report"])
async def update_recommendation(rec: RecommendationUpdate):
    """
    Called by Alternative Route Service (Step 10 in diagram) to post
    the computed alternative trail back to the Report Ingestion Service.
    Updates the stored hazard record with the recommendation.
    """
    log.info(
        "▶ Recommendation received | originalTrailId=%s recommendedTrailId=%s",
        rec.originalTrailId, rec.recommendedTrailId,
    )

    # Find the matching hazard record by trailId
    matching = [
        h for h in HAZARD_STORE.values()
        if h["trailId"] == rec.originalTrailId and h["hikerId"] == rec.hikerId
    ]

    if matching:
        latest = sorted(matching, key=lambda h: h["reportedAt"], reverse=True)[0]
        latest["recommendation"] = {
            "recommendedTrailId":      rec.recommendedTrailId,
            "recommendedTrailName":    rec.recommendedTrailName,
            "routeDistanceMeters":     rec.routeDistanceMeters,
            "estimatedTravelTimeMins": rec.estimatedTravelTimeMins,
            "updatedAt":               datetime.utcnow().isoformat() + "Z",
        }
        log.info("✓ Hazard record updated with recommendation | hazardId=%s", latest["hazardId"])

    return {
        "status":              "updated",
        "originalTrailId":     rec.originalTrailId,
        "recommendedTrailId":  rec.recommendedTrailId,
        "routeDistanceMeters": rec.routeDistanceMeters,
        "estimatedTravelTimeMins": rec.estimatedTravelTimeMins,
        "timestamp":           datetime.utcnow().isoformat() + "Z",
    }


# ── Get stored hazard reports ─────────────────────────────────────────────────

@app.get("/hazards", tags=["Hazard Report"])
async def get_all_hazards():
    """Returns all ingested hazard reports. In production this would query the DB."""
    return {
        "count":   len(HAZARD_STORE),
        "hazards": list(HAZARD_STORE.values()),
    }


@app.get("/hazards/{hazard_id}", tags=["Hazard Report"])
async def get_hazard(hazard_id: str):
    hazard = HAZARD_STORE.get(hazard_id)
    if not hazard:
        raise HTTPException(status_code=404, detail=f"Hazard '{hazard_id}' not found.")
    return hazard


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Report_Ingestion_Service"}


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "Report_Ingestion_Service:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8010)),
        reload=True,
    )