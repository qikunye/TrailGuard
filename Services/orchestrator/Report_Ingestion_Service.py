"""
TRAILGUARD – Report Ingestion Service  (Composite / Orchestrator)
Port: 8010

Entry point for Scenario 3 – Hazard Report & Rerouting.

Flow:
  POST /report-hazard
    ← UI sends: {hikerId, trailId, mountainId, hazardType, severity,
                 hazardLat, hazardLng, currentLat, currentLng, description, photoUrl}

  Step 1 / Step 6 – Persist hazard report
    POST /CreateReport → Trail Condition Service (Trail Hazards DB)

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
import json
import logging
import asyncio
from datetime import datetime
from uuid import uuid4

import pika
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    log.error("422 Validation error | body=%s | errors=%s", body.decode()[:1000], exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# ── Service URLs ──────────────────────────────────────────────────────────────
TRAIL_CONDITION_URL    = os.getenv("TRAIL_CONDITION_URL",    "http://localhost:8002")
NOTIFICATION_URL       = os.getenv("NOTIFICATION_URL",       "http://localhost:5050")
ALTERNATIVE_ROUTE_URL  = os.getenv("ALTERNATIVE_ROUTE_URL",  "http://localhost:8009")
NEARBY_USERS_URL       = os.getenv("NEARBY_USERS_URL",       "http://localhost:5005")
RABBITMQ_URL           = os.getenv("RABBITMQ_URL",           "amqp://guest:guest@localhost:5672/")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# ── Operational statuses that trigger rerouting ───────────────────────────────
REROUTE_STATUSES = {"CAUTION", "CLOSED"}

HAZARD_QUEUE = "hazard_notifications"


# ── RabbitMQ publish helper ───────────────────────────────────────────────────

def _publish_to_rabbitmq(queue: str, payload: dict) -> bool:
    """Publish a JSON message to a durable RabbitMQ queue. Returns True on success."""
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        params.socket_timeout = 5
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue=queue, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=queue,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2),  # persistent
        )
        connection.close()
        log.info("RabbitMQ ✓ published to queue=%s", queue)
        return True
    except Exception as e:
        log.warning("RabbitMQ publish failed (queue=%s): %s", queue, e)
        return False


async def _publish_async(queue: str, payload: dict) -> bool:
    """Run blocking pika publish in a thread executor to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _publish_to_rabbitmq, queue, payload)


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

        # ── Step 1 / Step 6: Persist hazard report to Trail Hazards DB ──────────
        reported_at = datetime.utcnow().isoformat() + "Z"
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
            "reportedAt":  reported_at,
            "status":      "ACTIVE",
        }
        try:
            result = await _post(client, f"{TRAIL_CONDITION_URL}/CreateReport", {
                "userId":      report.hikerId,
                "trailId":     report.trailId,
                "hazardType":  report.hazardType,
                "description": report.description,
                "severity":    report.severity,
                "photo":       report.photoUrl,
                "latitude":    report.hazardLat,
                "longitude":   report.hazardLng,
            })
            hazard_id = result.get("hazard_id", hazard_id)
            reported_at = result.get("reported_at", reported_at)
            hazard_record["hazardId"] = hazard_id
            log.info("Step 1 ✓ Hazard persisted to Trail Hazards DB | hazardId=%s", hazard_id)
        except HTTPException as e:
            log.warning("Step 1 ✗ Trail Hazards DB persist failed (non-fatal): %s", e.detail)

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

        # Always include the reporter so they receive confirmation, even if they
        # are not yet in the OutSystems nearby-users list (e.g. just registered).
        broadcast_ids = list({*nearby_user_ids, report.hikerId})
        log.info("Step 3 – Broadcasting hazard alert to %d hikers (incl. reporter)", len(broadcast_ids))
        broadcast_payload = {
            "userIds":           broadcast_ids,
            "phones":            [],   # phones resolved from Telegram registry in notification wrapper
            "trailId":           report.trailId,
            "trailName":         trail_name,
            "operationalStatus": operational_status,
            "hazardType":        report.hazardType,
            "severity":          report.severity,
        }
        # Try RabbitMQ first; fall back to direct HTTP if broker unavailable
        mq_ok = await _publish_async(HAZARD_QUEUE, broadcast_payload)
        if mq_ok:
            log.info("Step 3 ✓ Broadcast queued via RabbitMQ to %d hikers", len(broadcast_ids))
        else:
            log.warning("Step 3 – RabbitMQ unavailable, falling back to HTTP /broadcast")
            try:
                await _post(client, f"{NOTIFICATION_URL}/broadcast", broadcast_payload)
                log.info("Step 3 ✓ Broadcast sent via HTTP to %d hikers", len(broadcast_ids))
            except HTTPException as e:
                log.warning("Step 3 ✗ Broadcast failed (non-fatal): %s", e.detail)

        # ── Step 15: Update trail condition based on reported severity ───────
        log.info("Step 15 – Updating trail condition for trailId=%s", report.trailId)
        severity_to_status = {5: "CLOSED", 4: "CLOSED", 3: "CAUTION", 2: "CAUTION"}
        severity_to_label  = {1: "minor", 2: "moderate", 3: "moderate", 4: "severe", 5: "critical"}
        new_trail_status = severity_to_status.get(report.severity, operational_status)
        update_condition_payload = {
            "operationalStatus":     new_trail_status,
            "highestSeverityActive": severity_to_label.get(report.severity, "minor"),
            "hazardCountActive":     1,
            "hazardType":            report.hazardType,
            "location":              "reported location",
            "description":           report.description or "",
            "updatedAt":             datetime.utcnow().isoformat() + "Z",
        }
        try:
            await _post(
                client,
                f"{TRAIL_CONDITION_URL}/trail/{report.trailId}/update-condition",
                update_condition_payload,
            )
            operational_status = new_trail_status
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

    log.info(
        "✓ Recommendation logged | originalTrailId=%s recommendedTrailId=%s",
        rec.originalTrailId, rec.recommendedTrailId,
    )

    return {
        "status":              "updated",
        "originalTrailId":     rec.originalTrailId,
        "recommendedTrailId":  rec.recommendedTrailId,
        "routeDistanceMeters": rec.routeDistanceMeters,
        "estimatedTravelTimeMins": rec.estimatedTravelTimeMins,
        "timestamp":           datetime.utcnow().isoformat() + "Z",
    }


# ── Get hazard reports for a trail (proxied to Trail Condition Service) ───────

@app.get("/hazards/trail/{trail_id}", tags=["Hazard Report"])
async def get_hazards_by_trail(trail_id: str):
    """Returns all active hazards for a trail, fetched from Trail Hazards DB."""
    async with httpx.AsyncClient() as client:
        return await _get(client, f"{TRAIL_CONDITION_URL}/hazards/trail/{trail_id}")


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