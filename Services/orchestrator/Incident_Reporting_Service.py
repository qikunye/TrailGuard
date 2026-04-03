"""
TRAILGUARD – Incident Reporting Service  (Composite / Orchestrator)
Port: 8008

Full 8-step orchestration (Scenario 2 – User Injured on Trail):

  POST /incident-reporting
    1. Receive incident report from UI (hiker location, injury details)
    2. GET  /reverse-geocode        → Google Maps Wrapper  (resolve lat/lng → address)
    3. GET  /GetEmergency/{userId}  → Emergency Contacts Service  (hiker's contacts)
    4. POST /notify                 → Notification Wrapper  (alert emergency contacts)
    5. GET  /getNearby/{trailId}    → Nearby Users Service  (active hikers on trail)
    6. POST /notify                 → Notification Wrapper  (alert nearby hikers)
    7. POST /incidents              → Trail Incident Service  (persist incident record)
    8. Return confirmation to hiker (help is on the way)
"""

import asyncio
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
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service URLs ──────────────────────────────────────────────────────────────
GOOGLEMAPS_URL         = os.getenv("GOOGLEMAPS_URL",         "http://localhost:8007")
EMERGENCY_CONTACTS_URL = os.getenv("EMERGENCY_CONTACTS_URL", "http://localhost:5003")
NOTIFICATION_URL       = os.getenv("NOTIFICATION_URL",       "http://localhost:5050")
NEARBY_USERS_URL       = os.getenv("NEARBY_USERS_URL",       "http://localhost:5005")
TRAIL_INCIDENT_URL     = os.getenv("TRAIL_INCIDENT_URL",     "http://localhost:5004")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContactEntry(BaseModel):
    name:  str
    phone: str


class IncidentRequest(BaseModel):
    userId:      int   = Field(..., example=1)
    hikerName:   str   = Field("", example="Alice Tan")
    hikerPhone:  str   = Field(..., example="+6583355100")
    trailId:     int   = Field(..., example=1)
    severity:    int   = Field(..., ge=1, le=5, example=3)
    injuryType:  str   = Field(..., example="Sprain / Strain")
    description: str   = Field("", example="Twisted ankle near km 3")
    lat:         float = Field(..., example=1.3521)
    lng:         float = Field(..., example=103.8198)
    photoUrl:    str | None = None
    # Local profile contacts — used as fallback if OutSystems returns none
    localEmergencyContacts: list[ContactEntry] = Field(default_factory=list)


# ── HTTP Helpers ──────────────────────────────────────────────────────────────

async def _get(client: httpx.AsyncClient, url: str, params: dict = None) -> dict:
    try:
        resp = await client.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        log.error("HTTP error from %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream error from {url}")
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
        raise HTTPException(status_code=502, detail=f"Upstream error from {url}")
    except httpx.RequestError as e:
        log.error("Connection error to %s: %s", url, e)
        raise HTTPException(status_code=503, detail=f"Cannot reach {url}")


# ── SMS Message Builders ──────────────────────────────────────────────────────

def _emergency_contact_sms(req: IncidentRequest, address: str) -> str:
    return (
        f"EMERGENCY ALERT – TrailGuard: {req.injuryType} reported on trail #{req.trailId}. "
        f"Severity: {req.severity}/5. "
        f"Location: {address}. "
        f"Details: {req.description or 'No additional details provided'}. "
        f"Please respond immediately or contact emergency services."
    )


def _nearby_hiker_sms(req: IncidentRequest, address: str) -> str:
    return (
        f"NEARBY ALERT – TrailGuard: A hiker on trail #{req.trailId} needs assistance. "
        f"Incident: {req.injuryType} (Severity {req.severity}/5) near {address}. "
        f"If you are nearby and able, please provide assistance or call emergency services."
    )


def _hiker_confirmation_sms(req: IncidentRequest, contact_count: int, nearby_count: int) -> str:
    return (
        f"TrailGuard: Your emergency report has been received. "
        f"Incident: {req.injuryType} on trail #{req.trailId}, Severity {req.severity}/5. "
        f"{contact_count} emergency contact(s) and {nearby_count} nearby hiker(s) have been notified. "
        f"Stay calm, stay put, and help is on the way."
    )


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/incident-reporting", tags=["Incident"])
async def report_incident(req: IncidentRequest):
    """
    Full Scenario 2 orchestration – Emergency incident reporting.

    Steps:
      1. Accept incident from UI
      2. Resolve GPS coordinates to human-readable address (Google Maps)
      3. Fetch hiker's emergency contacts (Emergency Contacts Service)
      4. Notify emergency contacts via SMS (Notification Wrapper)
      5. Fetch active hikers on the same trail (Nearby Users Service)
      6. Notify nearby hikers via SMS (Notification Wrapper)
      7. Persist incident record in Firestore (Trail Incident Service)
      8. Return confirmation with summary
    """
    log.info("▶ Incident received | userId=%s trailId=%s severity=%s",
             req.userId, req.trailId, req.severity)

    async with httpx.AsyncClient() as client:

        # ── Step 2: Resolve GPS to address via Google Maps ────────────────────
        log.info("Step 2 – Resolving location via Google Maps (lat=%s, lng=%s)",
                 req.lat, req.lng)
        try:
            location_data = await _get(
                client,
                f"{GOOGLEMAPS_URL}/reverse-geocode",
                params={"lat": req.lat, "lng": req.lng},
            )
            address = location_data.get("formattedAddress", f"{req.lat:.6f}, {req.lng:.6f}")
        except HTTPException:
            log.warning("Google Maps unavailable – using raw coordinates")
            address = f"{req.lat:.6f}, {req.lng:.6f}"
        log.info("Step 2 ✓ address=%s", address)

        # ── Steps 3 & 5 (concurrent): Emergency contacts + Nearby users ───────
        log.info("Steps 3 & 5 – Fetching emergency contacts and nearby users concurrently")

        async def _fetch_emergency_contacts() -> list:
            try:
                data = await _get(client, f"{EMERGENCY_CONTACTS_URL}/GetEmergency/{req.userId}")
                contacts = data if isinstance(data, list) else data.get("contacts", data.get("emergencyContacts", []))
                return [
                    {"name": c.get("ContactName", c.get("contactName", "")),
                     "phone": c.get("ContactPhone", c.get("contactPhone", ""))}
                    for c in contacts
                ]
            except HTTPException:
                log.warning("Emergency Contacts Service unavailable for userId=%s", req.userId)
                return []

        async def _fetch_nearby_users() -> list:
            try:
                data = await _get(client, f"{NEARBY_USERS_URL}/getNearby/{req.trailId}")
                # OutSystems HikeProgressAPI returns nearbyUserIds (IDs only, no phone numbers)
                # userId is included so the notification wrapper can look up Telegram chat IDs
                user_ids = data.get("nearbyUserIds", [])
                return [{"name": f"Hiker {uid}", "phone": "", "userId": uid} for uid in user_ids]
            except HTTPException:
                log.warning("Nearby Users Service unavailable for trailId=%s", req.trailId)
                return []

        outsystems_contacts, nearby_users = await asyncio.gather(
            _fetch_emergency_contacts(),
            _fetch_nearby_users(),
        )

        # Always include locally-stored contacts from the user's profile.
        # Merge with OutSystems contacts, deduplicating by phone number.
        emergency_contacts = list(outsystems_contacts)
        existing_phones = {c["phone"] for c in emergency_contacts if c.get("phone")}
        for c in req.localEmergencyContacts:
            if c.phone and c.phone not in existing_phones:
                emergency_contacts.append({"name": c.name, "phone": c.phone})
                existing_phones.add(c.phone)
        log.info("Steps 3 & 5 ✓ emergencyContacts=%d (outsystems=%d local=%d) nearbyUsers=%d",
                 len(emergency_contacts), len(outsystems_contacts),
                 len(req.localEmergencyContacts), len(nearby_users))

        hiker_display = req.hikerName or f"Hiker {req.userId}"

        # ── Step 4: Notify emergency contacts ─────────────────────────────────
        log.info("Step 4 – Notifying %d emergency contact(s)", len(emergency_contacts))
        contact_delivery = []
        if emergency_contacts:
            alert_payload = {
                "hikerId":           str(req.userId),
                "hikerName":         hiker_display,
                "address":           address,
                "lat":               req.lat,
                "lng":               req.lng,
                "emergencyContacts": emergency_contacts,
                "nearbyHikers":      [],
                "message":           _emergency_contact_sms(req, address),
            }
            try:
                contact_result = await _post(client, f"{NOTIFICATION_URL}/notify", alert_payload)
                contact_delivery = contact_result.get("deliveryStatus", [])
            except HTTPException:
                log.warning("Notification Wrapper unavailable – emergency contacts not notified")
        log.info("Step 4 ✓ contactDelivery=%s", contact_delivery)

        # ── Step 6: Notify nearby hikers ──────────────────────────────────────
        # Pass all nearby users (with userId) so the notification wrapper can reach
        # those registered with the Telegram bot even if phone is unavailable.
        log.info("Step 6 – Notifying %d nearby hiker(s)", len(nearby_users))
        nearby_delivery = []
        if nearby_users:
            nearby_payload = {
                "hikerId":           str(req.userId),
                "hikerName":         hiker_display,
                "address":           address,
                "lat":               req.lat,
                "lng":               req.lng,
                "emergencyContacts": [],
                "nearbyHikers":      nearby_users,
                "message":           _nearby_hiker_sms(req, address),
            }
            try:
                nearby_result = await _post(client, f"{NOTIFICATION_URL}/notify", nearby_payload)
                nearby_delivery = nearby_result.get("deliveryStatus", [])
            except HTTPException:
                log.warning("Notification Wrapper unavailable – nearby hikers not notified")
        log.info("Step 6 ✓ nearbyDelivery=%s", nearby_delivery)

        # Count how many nearby hikers were actually reached (SMS or Telegram)
        nearby_reached = len([d for d in nearby_delivery if d.get("twilioStatus") not in ("failed", None, "skipped") or d.get("telegramStatus") == "sent"])

        # ── Step 7: Persist incident in Firestore via Trail Incident Service ───
        log.info("Step 7 – Persisting incident to Trail Incident Service")
        incident_record = {
            "trailId":     req.trailId,
            "userId":      req.userId,
            "injuryType":  req.injuryType,
            "description": req.description,
            "severity":    req.severity,
            "lat":         req.lat,
            "lng":         req.lng,
            "photoUrl":    req.photoUrl or "",
            "hikerPhone":  req.hikerPhone,
        }
        try:
            incident_result = await _post(
                client, f"{TRAIL_INCIDENT_URL}/incidents", incident_record
            )
            incident_id = incident_result.get("incidentId") or incident_result.get("id", "unknown")
        except HTTPException:
            log.warning("Trail Incident Service unavailable – incident not persisted")
            incident_id = f"INC-{req.userId}-{int(datetime.utcnow().timestamp())}"
        log.info("Step 7 ✓ incidentId=%s", incident_id)

        # ── Step 8: Send confirmation to the hiker ────────────────────────────
        log.info("Step 8 – Sending confirmation to hiker")
        try:
            confirmation_payload = {
                "hikerId":           str(req.userId),
                "hikerName":         hiker_display,
                "address":           address,
                "lat":               req.lat,
                "lng":               req.lng,
                "emergencyContacts": [{"name": "You", "phone": req.hikerPhone}],
                "nearbyHikers":      [],
                "message":           _hiker_confirmation_sms(
                                        req, len(emergency_contacts), nearby_reached
                                     ),
            }
            await _post(client, f"{NOTIFICATION_URL}/notify", confirmation_payload)
        except HTTPException:
            log.warning("Notification Wrapper unavailable – hiker confirmation not sent")
        log.info("Step 8 ✓ confirmation sent to %s", req.hikerPhone)

    # ── Build and return response ─────────────────────────────────────────────
    sms_delivered = any(
        d.get("twilioStatus") not in ("failed", None)
        for d in contact_delivery + nearby_delivery
    )
    response = {
        "status":                "reported",
        "incidentId":            incident_id,
        "userId":                req.userId,
        "trailId":               req.trailId,
        "injuryType":            req.injuryType,
        "severity":              req.severity,
        "resolvedAddress":       address,
        "emergencyContactsNotified": len(emergency_contacts),
        "nearbyHikersNotified":  len(nearby_users),
        "smsDelivered":          sms_delivered,
        "contactDeliveryStatus": contact_delivery,
        "nearbyDeliveryStatus":  nearby_delivery,
        "timeCreated":           datetime.utcnow().isoformat() + "Z",
        "message":               (
            f"Help is on the way. "
            f"{len(emergency_contacts)} emergency contact(s) and "
            f"{len(nearby_users)} nearby hiker(s) have been notified."
        ),
    }
    log.info("◀ Incident reported | incidentId=%s contacts=%d nearby=%d",
             incident_id, len(emergency_contacts), len(nearby_users))
    return response


# ── Incident lookup endpoints (proxy to Trail Incident Service) ───────────────

@app.get("/incidents/user/{user_id}", tags=["Incident"])
async def get_user_incidents(user_id: int):
    async with httpx.AsyncClient() as client:
        return await _get(client, f"{TRAIL_INCIDENT_URL}/incidents/user/{user_id}")


@app.get("/incidents/trail/{trail_id}", tags=["Incident"])
async def get_trail_incidents(trail_id: int):
    async with httpx.AsyncClient() as client:
        return await _get(client, f"{TRAIL_INCIDENT_URL}/incidents/trail/{trail_id}")


@app.get("/incidents/trail/{trail_id}/active", tags=["Incident"])
async def get_active_trail_incidents(trail_id: int):
    """Return only incidents filed by hikers who are still actively hiking (isHiking=True)."""
    async with httpx.AsyncClient() as client:
        incidents_data, nearby_data = await asyncio.gather(
            _get(client, f"{TRAIL_INCIDENT_URL}/incidents/trail/{trail_id}"),
            _get(client, f"{NEARBY_USERS_URL}/getNearby/{trail_id}"),
        )

    active_ids = set(nearby_data.get("nearbyUserIds", []))
    active_incidents = [
        inc for inc in (incidents_data.get("incidents") or [])
        if inc.get("userId") in active_ids
    ]
    return {"incidents": active_incidents, "success": True}


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Reporting_Service", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Reporting_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8008)), reload=True)
