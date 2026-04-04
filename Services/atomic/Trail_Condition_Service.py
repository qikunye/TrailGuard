"""
TRAILGUARD – Trail Condition Service  (Atomic)
Port: 8002

Returns difficulty rating, surface state, active hazard count, and closure flags.

OutSystems TrailConditionAPI quirks (as observed):
  - operationalStatus is uppercase ("OPEN", "CLOSED", "CAUTION")
  - ErrorCode is "INTERNAL_ERROR" (string) even on successful responses —
    treat as success whenever operationalStatus is a non-empty string
  - activeHazardCounts, highestSeverity, hazardTypes are NOT returned by the
    real API; we default them so downstream services always get those fields
"""

import os
import httpx
import logging
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

log = logging.getLogger("trail_condition")

app = FastAPI(title="TRAILGUARD – Trail Condition Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Real OutSystems TrailConditionAPI base URL (optional — falls back to local data if unset)
OUTSYSTEMS_CONDITION_URL = os.getenv(
    "OUTSYSTEMS_TRAIL_CONDITION_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/TrailConditionAPI",
)

# ── Trail data (matches real TrailDBAPI schema) ───────────────────────────────
# trailId       : integer ID from the real API (stored as string key)
# difficulty    : "Easy" | "Moderate" | "Hard"  (string, from real API)
# operationalStatus: "OPEN" | "CLOSED" | "CAUTION"  (uppercase, from real API)
# startPoint / endPoint: "lat, lng"  coordinate strings (from real API)
TRAIL_DB: dict[str, dict] = {
    # startPoint / endPoint: road-accessible trailhead / carpark entrances
    # so that Google Maps Directions can route to/from them.
    "1": {
        "trailId": "1", "name": "Southern Ridges Loop",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        "startPoint": "1.2644, 103.8208", "endPoint": "1.2895, 103.8043",
        "distanceKm": 9.0, "estimatedDurationMins": 162, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "2": {
        "trailId": "2", "name": "MacRitchie Reservoir Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        "startPoint": "1.3442, 103.8197", "endPoint": "1.3592, 103.8320",
        "distanceKm": 11.0, "estimatedDurationMins": 242, "recommendedPaceMinsPerKm": 22,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "3": {
        "trailId": "3", "name": "Bukit Timah Summit Trail",
        "difficulty": "Hard", "difficultyRating": 4,
        "operationalStatus": "OPEN",
        "startPoint": "1.3511, 103.7761", "endPoint": "1.3468, 103.7738",
        "distanceKm": 6.0, "estimatedDurationMins": 168, "recommendedPaceMinsPerKm": 28,
        "activeHazards": 1,
        "hazardDetails": [{"type": "slippery_rocks", "severity": "minor", "location": "upper slope"}],
        "isClosed": False,
    },
    "4": {
        "trailId": "4", "name": "Labrador Nature Reserve Trail",
        "difficulty": "Easy", "difficultyRating": 1,
        "operationalStatus": "OPEN",
        "startPoint": "1.2627, 103.8030", "endPoint": "1.2706, 103.8083",
        "distanceKm": 4.0, "estimatedDurationMins": 72, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "5": {
        "trailId": "5", "name": "Sungei Buloh Wetland Walk",
        "difficulty": "Easy", "difficultyRating": 1,
        "operationalStatus": "OPEN",
        "startPoint": "1.4467, 103.7240", "endPoint": "1.4514, 103.7304",
        "distanceKm": 7.0, "estimatedDurationMins": 126, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "6": {
        "trailId": "6", "name": "Bukit Batok Nature Park Loop",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        "startPoint": "1.3479, 103.7601", "endPoint": "1.3504, 103.7635",
        "distanceKm": 5.0, "estimatedDurationMins": 90, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "7": {
        "trailId": "7", "name": "Pulau Ubin Chek Jawa Trail",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        "startPoint": "1.4044, 103.9592", "endPoint": "1.4002, 103.9671",
        "distanceKm": 6.0, "estimatedDurationMins": 108, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "8": {
        "trailId": "8", "name": "Kent Ridge Park Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        "startPoint": "1.2960, 103.7836", "endPoint": "1.2875, 103.7880",
        "distanceKm": 5.0, "estimatedDurationMins": 110, "recommendedPaceMinsPerKm": 22,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "9": {
        "trailId": "9", "name": "Admiralty Park Mangrove Trail",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "CAUTION",
        "startPoint": "1.4406, 103.7990", "endPoint": "1.4451, 103.8032",
        "distanceKm": 4.0, "estimatedDurationMins": 72, "recommendedPaceMinsPerKm": 18,
        "activeHazards": 1,
        "hazardDetails": [{"type": "slippery_boardwalk", "severity": "moderate", "location": "mangrove section"}],
        "isClosed": False,
    },
    "10": {
        "trailId": "10", "name": "Clementi Forest Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        "startPoint": "1.3243, 103.7682", "endPoint": "1.3299, 103.7748",
        "distanceKm": 7.0, "estimatedDurationMins": 154, "recommendedPaceMinsPerKm": 22,
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
}

# ── Trail Hazards store (Trail Hazards DB) ───────────────────────────────────
# Keyed by hazard_id.  In production this would be a SQL table.
HAZARD_DB: dict[str, dict] = {}


class HazardReport(BaseModel):
    userId:      str   = Field(...,  example="usr_001")
    trailId:     str   = Field(...,  example="1")
    hazardType:  str   = Field(...,  example="landslide")
    description: str   = Field("",  example="Rockfall blocking main path")
    severity:    int   = Field(...,  ge=1, le=5)
    photo:       str | None = None
    latitude:    float = Field(...,  example=1.3511)
    longitude:   float = Field(...,  example=103.7761)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _highest_severity(hazard_details: list) -> str:
    rank = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "critical": 4}
    if not hazard_details:
        return "none"
    return max(hazard_details, key=lambda h: rank.get(h.get("severity", "minor"), 1))["severity"]


def _is_closed(data: dict) -> bool:
    return data.get("isClosed", False) or data.get("operationalStatus") == "CLOSED"


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/trail/{trail_id}/conditions", tags=["Trail"])
async def get_trail_conditions(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Trail '{trail_id}' not found.")
    return data


@app.get("/GetAllTrails", tags=["TrailDBAPI"])
async def get_all_trails():
    trails = [
        {
            "trailId":           data["trailId"],
            "trailName":         data["name"],
            "difficulty":        data["difficulty"],
            "operationalStatus": data["operationalStatus"],
            "startPoint":        data["startPoint"],
            "endPoint":          data["endPoint"],
        }
        for data in TRAIL_DB.values()
    ]
    return {"trails": trails, "totalCount": len(trails), "Success": True, "ErrorCode": 0}


# ── Swagger-aligned endpoint: TrailConditionAPI / Condition ──────────────────
# Mirrors: GET /HikerProfileService/rest/TrailConditionAPI/Condition/{trailId}
# Tries the real OutSystems API first; falls back to local TRAIL_DB.
#
# OutSystems response quirks handled here:
#   - operationalStatus uppercase → normalised to lowercase
#   - ErrorCode "INTERNAL_ERROR" string → treated as success if operationalStatus present
#   - activeHazardCounts / highestSeverity / hazardTypes missing → defaulted from local data
@app.get("/Condition/{trail_id}", tags=["TrailConditionAPI"])
async def get_condition(trail_id: str):
    os_status: str | None = None

    # ── 1. Try real OutSystems API ────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OUTSYSTEMS_CONDITION_URL}/Condition/{trail_id}")
            if r.status_code == 200:
                raw = r.json()
                raw_status = raw.get("operationalStatus")
                # Success: operationalStatus is a non-empty string
                # (ErrorCode "INTERNAL_ERROR" is an OutSystems quirk — not a real error)
                if raw_status:
                    os_status = raw_status.lower()
                    log.info("OutSystems Condition/%s → operationalStatus=%s", trail_id, os_status)
    except Exception as exc:
        log.warning("OutSystems TrailConditionAPI unavailable (%s) — using local data", exc)

    # ── 2. Resolve local fallback data ────────────────────────────────────────
    local = TRAIL_DB.get(trail_id)
    if os_status is None and local is None:
        return {
            "operationalStatus": None, "activeHazardCounts": None,
            "highestSeverity": None, "hazardTypes": None,
            "Success": False, "ErrorCode": 404,
            "ErrorMessage": f"Trail '{trail_id}' not found.",
        }

    # Prefer OutSystems operationalStatus; fall back to local
    if os_status is not None:
        final_status = os_status
    else:
        final_status = "closed" if _is_closed(local) else local["operationalStatus"].lower()

    # activeHazardCounts / highestSeverity / hazardTypes: OutSystems doesn't return
    # these, so always source from local data (default 0 / "none" / [] if trail unknown)
    hazard_details = (local or {}).get("hazardDetails", [])
    return {
        "operationalStatus":  final_status,
        "activeHazardCounts": (local or {}).get("activeHazards", 0),
        "highestSeverity":    _highest_severity(hazard_details),
        "hazardTypes":        list({h["type"] for h in hazard_details}),
        "lastUpdated":        datetime.now(timezone.utc).isoformat(),
        "Success": True, "ErrorCode": 0, "ErrorMessage": "",
    }


@app.get("/GetTrail/{trail_id}", tags=["TrailDBAPI"])
async def get_trail(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        return {"trailId": trail_id, "trailName": None, "difficulty": None,
                "operationalStatus": None, "Success": False, "ErrorCode": 404}
    closed = _is_closed(data)
    return {
        "trailId":           data["trailId"],
        "trailName":         data["name"],
        "difficulty":        data["difficultyRating"],   # integer (1-5) for downstream use
        "difficultyLabel":   data["difficulty"],          # "Easy"/"Moderate"/"Hard" for display
        "operationalStatus": "closed" if closed else data["operationalStatus"].lower(),
        "Success": True, "ErrorCode": 0,
    }


@app.post("/trail/{trail_id}/update-condition", tags=["Trail"])
async def update_trail_condition(trail_id: str, body: dict):
    """
    Step 15 — Called by Report Ingestion Service after a hazard is reported.
    Updates operationalStatus, activeHazards, and hazardDetails in TRAIL_DB.
    Body: {operationalStatus, highestSeverityActive, hazardCountActive, hazardType, location?, updatedAt?}
    """
    data = TRAIL_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Trail '{trail_id}' not found.")

    new_status   = body.get("operationalStatus", data["operationalStatus"]).upper()
    hazard_count = body.get("hazardCountActive", data["activeHazards"] + 1)
    severity_str = body.get("highestSeverityActive", "minor")
    hazard_type  = body.get("hazardType")

    data["operationalStatus"] = new_status
    data["activeHazards"]     = hazard_count
    data["isClosed"]          = new_status == "CLOSED"

    if hazard_type:
        data["hazardDetails"].append({
            "type":        hazard_type.lower().replace(" ", "_"),
            "severity":    severity_str,
            "location":    body.get("location", "reported location"),
            "description": body.get("description", ""),
            "reported_at": body.get("updatedAt", datetime.now(timezone.utc).isoformat()),
        })

    log.info("Trail %s updated → status=%s activeHazards=%d", trail_id, new_status, hazard_count)
    return {
        "trailId":           trail_id,
        "operationalStatus": new_status,
        "activeHazards":     hazard_count,
        "updatedAt":         body.get("updatedAt", datetime.now(timezone.utc).isoformat()),
        "Success": True,
    }


@app.post("/trails/candidates", tags=["Trail"])
async def get_candidate_trails(body: dict):
    """
    Returns all OPEN trails excluding the specified one.
    Body: {excludeTrailId, requiredOperationalStatus?}
    """
    exclude_id = body.get("excludeTrailId", "")
    required   = body.get("requiredOperationalStatus", "OPEN").upper()

    def _parse_coord(coord_str: str):
        parts = coord_str.split(",")
        return float(parts[0].strip()), float(parts[1].strip())

    candidates = []
    for data in TRAIL_DB.values():
        if data["trailId"] == exclude_id:
            continue
        if data["operationalStatus"].upper() != required:
            continue
        start_lat, start_lng = _parse_coord(data["startPoint"])
        end_lat, end_lng     = _parse_coord(data["endPoint"])
        candidates.append({
            "trailId":       data["trailId"],
            "name":          data["name"],
            "difficulty":    data["difficulty"],
            "startPoint":    data["startPoint"],
            "endPoint":      data["endPoint"],
            "trailHeadLat":  start_lat,
            "trailHeadLng":  start_lng,
            "trailEndLat":   end_lat,
            "trailEndLng":   end_lng,
        })

    return {"candidateTrails": candidates, "count": len(candidates)}


@app.post("/CreateReport", tags=["Trail Hazards"])
async def create_report(body: HazardReport):
    """
    Step 6 — Called by Report Ingestion Service to persist a hazard report
    to the Trail Hazards DB.
    """
    hazard_id = f"HAZ-{body.trailId}-{uuid4().hex[:8].upper()}"
    reported_at = datetime.now(timezone.utc).isoformat()

    record = {
        "hazard_id":   hazard_id,
        "trail_id":    body.trailId,
        "user_id":     body.userId,
        "hazard_type": body.hazardType,
        "description": body.description,
        "severity":    body.severity,
        "photo":       body.photo or "",
        "latitude":    body.latitude,
        "longitude":   body.longitude,
        "status":      "ACTIVE",
        "reported_at": reported_at,
    }
    HAZARD_DB[hazard_id] = record
    log.info("Hazard report created | hazardId=%s trailId=%s", hazard_id, body.trailId)
    return {"hazard_id": hazard_id, "success": True, "reported_at": reported_at}


@app.get("/hazards/trail/{trail_id}", tags=["Trail Hazards"])
async def get_hazards_by_trail(trail_id: str):
    """Returns all ACTIVE hazards for a trail from the Trail Hazards DB."""
    hazards = [
        h for h in HAZARD_DB.values()
        if str(h["trail_id"]) == str(trail_id) and h["status"] == "ACTIVE"
    ]
    hazards.sort(key=lambda h: h["reported_at"], reverse=True)
    return {"hazards": hazards, "count": len(hazards), "success": True}


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Condition_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Condition_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8002)), reload=True)
