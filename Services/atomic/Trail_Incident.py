"""
TRAILGUARD – Incident Service  (Atomic)
Port: 5004

Stores and retrieves incident reports in Firestore.

Endpoints:
  POST /incidents                → create a new incident
  GET  /incidents/trail/<id>     → fetch all incidents for a trail (ordered by reportedAt desc)
  GET  /incidents/<incident_id>  → fetch a single incident by document ID
  GET  /health                   → liveness check
"""

import os
import json
import logging

import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from google.auth.exceptions import DefaultCredentialsError
from google.cloud.firestore_v1 import GeoPoint

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("IncidentService")

# ── Firebase init ─────────────────────────────────────────────────────────────

def _init_firebase():
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    else:
        # Fall back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)
    log.info("Firebase Admin SDK initialised")

_init_firebase()

# Lazy Firestore client — resolved on first use so the service starts even if
# credentials are not yet wired up (the first Firestore call will then 503).
_db = None

def get_db():
    global _db
    if _db is None:
        _db = firestore.client()
    return _db

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="TRAILGUARD – Incident Service", version="1.0.0")


@app.exception_handler(DefaultCredentialsError)
async def credentials_error_handler(request: Request, exc: DefaultCredentialsError):
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "error": "Firestore credentials not configured. "
                     "Set FIREBASE_SERVICE_ACCOUNT_JSON in Services/.env with your "
                     "Firebase service account key (minified JSON on one line).",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schema ────────────────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    trailId:     int
    userId:      int
    injuryType:  str   = Field(..., max_length=50)
    description: str
    severity:    int   = Field(..., ge=1, le=5)
    photoUrl:    str   = ""
    lat:         float
    lng:         float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialise(data: dict) -> dict:
    """Convert Firestore-specific types to JSON-safe values."""
    if data.get("location") and isinstance(data["location"], GeoPoint):
        loc = data["location"]
        data["location"] = {"lat": loc.latitude, "lng": loc.longitude}
    if data.get("reportedAt") and hasattr(data["reportedAt"], "isoformat"):
        data["reportedAt"] = data["reportedAt"].isoformat()
    return data


# ── Endpoints ─────────────────────────────────────────────────────────────────

# NOTE: /incidents/trail/{trail_id} must be defined before /incidents/{incident_id}
# so FastAPI does not match the literal "trail" as an incident_id.

@app.post("/incidents", tags=["Incidents"])
async def create_incident(body: IncidentCreate):
    doc_ref = get_db().collection("incidents").document()
    doc_ref.set({
        "incidentId":  doc_ref.id,
        "trailId":     body.trailId,
        "userId":      body.userId,
        "injuryType":  body.injuryType,
        "description": body.description,
        "severity":    body.severity,
        "photoUrl":    body.photoUrl,
        "location":    GeoPoint(body.lat, body.lng),
        "reportedAt":  firestore.SERVER_TIMESTAMP,
    })
    log.info("Incident created | id=%s trailId=%s userId=%s", doc_ref.id, body.trailId, body.userId)
    return {"incidentId": doc_ref.id, "success": True}


@app.get("/incidents/trail/{trail_id}", tags=["Incidents"])
async def get_incidents_by_trail(trail_id: int):
    docs = (
        get_db().collection("incidents")
        .where("trailId", "==", trail_id)
        .order_by("reportedAt", direction=firestore.Query.DESCENDING)
        .stream()
    )
    incidents = [_serialise(doc.to_dict()) for doc in docs]
    return {"incidents": incidents, "success": True}


@app.get("/incidents/{incident_id}", tags=["Incidents"])
async def get_incident(incident_id: str):
    doc = get_db().collection("incidents").document(incident_id).get()
    if not doc.exists:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "error": "Incident not found"},
        )
    return _serialise(doc.to_dict())


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 5004)), reload=True)
