"""
TRAILGUARD – Incident Reporting Service  (Composite / Orchestrator)
Port: 8007

Flow (matches architecture diagram):
  POST /incident-reporting
    1. Receive incident from UI
    2. GET hiker profile → Hiker Profile Service (emergency contact phone)
    3. POST /notify      → Notification Wrapper  (SMS to emergency contacts)
    4. Return aggregated result to UI
"""

import os
import logging
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("IncidentReportingService")

app = FastAPI(
    title="TRAILGUARD – Incident Reporting Service",
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
HIKER_PROFILE_URL    = os.getenv("HIKER_PROFILE_URL",    "http://localhost:8001")
NOTIFICATION_URL     = os.getenv("NOTIFICATION_URL",     "http://localhost:5050")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)


# ── Schemas ───────────────────────────────────────────────────────────────────

class Location(BaseModel):
    description: str = ""
    lat: float = 0.0
    lng: float = 0.0

class IncidentRequest(BaseModel):
    hikerId:     str   = Field(..., example="usr_001")
    hikerPhone:  str   = Field(..., example="+6583355100")
    trailId:     str   = Field(..., example="trail_mt_kinabalu")
    severity:    int   = Field(..., ge=1, le=5)
    injuryType:  str   = Field(..., example="Sprain / Strain")
    description: str   = Field("", example="Twisted ankle near km 3")
    location:    Location = Field(default_factory=Location)
    photoUrl:    str | None = None


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


def _build_alert_sms(req: IncidentRequest) -> str:
    """SMS sent to emergency contacts."""
    return (
        f"EMERGENCY ALERT: {req.injuryType} reported on {req.trailId}. "
        f"Severity: {req.severity}/5. "
        f"Details: {req.description or 'No additional details provided.'}. "
        f"Location: {req.location.description or 'Unknown'}. "
        f"Please respond immediately or contact emergency services."
    )

def _build_confirmation_sms(req: IncidentRequest) -> str:
    """Confirmation SMS sent back to the hiker who submitted the report."""
    return (
        f"TrailGuard: Your emergency report has been received. "
        f"Incident: {req.injuryType} on {req.trailId}. "
        f"Severity: {req.severity}/5. "
        f"Emergency services have been notified. Stay calm and stay put."
    )


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/incident-reporting", tags=["Incident"])
async def report_incident(req: IncidentRequest):
    """
    Composite orchestration for emergency incident reporting.
    Fetches the hiker's emergency contact, then sends SMS via Notification Wrapper.
    """
    log.info("▶ Incident received | hikerId=%s trailId=%s severity=%s", req.hikerId, req.trailId, req.severity)

    async with httpx.AsyncClient() as client:

        # ── Step 1: Fetch hiker profile to get emergency contact ──────────────
        log.info("Step 1 – Fetching hiker profile for hikerId=%s", req.hikerId)
        try:
            profile = await _get(client, f"{HIKER_PROFILE_URL}/hiker/{req.hikerId}")
        except HTTPException:
            # If hiker profile is unavailable, still attempt notification with empty contacts
            log.warning("Hiker profile unavailable for %s — proceeding without emergency contact", req.hikerId)
            profile = {}

        raw_contact = profile.get("emergencyContact", "")
        emergency_contacts = (
            [{"name": profile.get("name", "Emergency Contact"), "phone": raw_contact}]
            if raw_contact else []
        )
        log.info("Step 1 ✓ emergencyContacts=%s", emergency_contacts)

        # ── Step 2: Send SMS via Notification Wrapper ─────────────────────────
        # Sends alert to emergency contacts AND a confirmation back to the hiker
        log.info("Step 2 – Sending SMS via Notification Wrapper")
        # Alert SMS → emergency contacts
        alert_payload = {
            "hikerId":           req.hikerId,
            "lat":               req.location.lat,
            "lng":               req.location.lng,
            "emergencyContacts": emergency_contacts,
            "nearbyHikers":      [],
            "message":           _build_alert_sms(req),
        }
        notification_result = await _post(client, f"{NOTIFICATION_URL}/notify", alert_payload)

        # Confirmation SMS → back to the hiker who submitted the report
        confirmation_payload = {
            "hikerId":           req.hikerId,
            "lat":               req.location.lat,
            "lng":               req.location.lng,
            "emergencyContacts": [{"name": "You", "phone": req.hikerPhone}],
            "nearbyHikers":      [],
            "message":           _build_confirmation_sms(req),
        }
        confirmation_result = await _post(client, f"{NOTIFICATION_URL}/notify", confirmation_payload)
        log.info("Step 2 ✓ alertStatus=%s confirmationStatus=%s",
                 notification_result.get("deliveryStatus"),
                 confirmation_result.get("deliveryStatus"))

    response = {
        "status":           "reported",
        "incidentId":       f"INC-{req.hikerId}-{int(datetime.utcnow().timestamp())}",
        "hikerId":          req.hikerId,
        "trailId":          req.trailId,
        "severity":         req.severity,
        "contactsNotified": len(emergency_contacts),
        "deliveryStatus":   notification_result.get("deliveryStatus", []),
        "timeCreated":      datetime.utcnow().isoformat() + "Z",
    }
    log.info("◀ Incident reported | incidentId=%s contactsNotified=%s",
             response["incidentId"], response["contactsNotified"])
    return response


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Reporting_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Reporting_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8007)), reload=True)
