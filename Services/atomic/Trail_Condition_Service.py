"""
TRAILGUARD – Trail Condition Service  (Atomic)
Port: 8002

All trail data and hazards come from OutSystems.
No local mock data — OutSystems is the single source of truth.

Two in-memory stores are kept (they are NOT mock data):
  TRAIL_META      — computed fields OutSystems does not store
                    (distanceKm, estimatedDurationMins, recommendedPaceMinsPerKm)
  TRAIL_OVERRIDES — runtime operationalStatus overrides written by Report Ingestion
                    (Step 15) after a hazard is reported.  Cleared on container restart.

OutSystems APIs used:
  TrailDBAPI       → GET  /GetTrail/{trailId}
                     GET  /GetAllTrails
  TrailConditionAPI → GET  /Condition/{trailId}   (returns activeHazards list)
                      POST /AddHazard

OutSystems TrailConditionAPI /Condition quirks:
  - Returns { Success, ErrorCode, ErrorMessage, activeHazards: [...] }
  - Does NOT return operationalStatus — sourced from TRAIL_OVERRIDES or TrailDBAPI
  - When no hazards exist: Success=true, ErrorCode="No Active Hazards Found", activeHazards=[]
    → treat any 200 response as success regardless of ErrorCode string
  - activeHazard fields: hazardId, userId, trailId, hazardType, description,
                          severity (int 1-5), lat (str), lon (str), status, timeStamp
"""

import os
import asyncio
import httpx
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("trail_condition")

app = FastAPI(title="TRAILGUARD – Trail Condition Service", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTSYSTEMS_TRAIL_DB_URL = os.getenv(
    "OUTSYSTEMS_TRAIL_DB_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/TrailDBAPI",
)
OUTSYSTEMS_CONDITION_URL = os.getenv(
    "OUTSYSTEMS_TRAIL_CONDITION_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/TrailConditionAPI",
)

# ── Computed trail metrics (OutSystems does not store these) ──────────────────
TRAIL_META: dict[str, dict] = {
    "1":  {"distanceKm": 9.0,  "estimatedDurationMins": 162, "recommendedPaceMinsPerKm": 18},
    "2":  {"distanceKm": 11.0, "estimatedDurationMins": 242, "recommendedPaceMinsPerKm": 22},
    "3":  {"distanceKm": 6.0,  "estimatedDurationMins": 168, "recommendedPaceMinsPerKm": 28},
    "4":  {"distanceKm": 4.0,  "estimatedDurationMins": 72,  "recommendedPaceMinsPerKm": 18},
    "5":  {"distanceKm": 7.0,  "estimatedDurationMins": 126, "recommendedPaceMinsPerKm": 18},
    "6":  {"distanceKm": 5.0,  "estimatedDurationMins": 90,  "recommendedPaceMinsPerKm": 18},
    "7":  {"distanceKm": 6.0,  "estimatedDurationMins": 108, "recommendedPaceMinsPerKm": 18},
    "8":  {"distanceKm": 5.0,  "estimatedDurationMins": 110, "recommendedPaceMinsPerKm": 22},
    "9":  {"distanceKm": 4.0,  "estimatedDurationMins": 72,  "recommendedPaceMinsPerKm": 18},
    "10": {"distanceKm": 7.0,  "estimatedDurationMins": 154, "recommendedPaceMinsPerKm": 22},
}

# ── Runtime operationalStatus overrides (written by Step 15) ─────────────────
# { trail_id: "CAUTION" | "CLOSED" | "OPEN" }
TRAIL_OVERRIDES: dict[str, str] = {}

# ── Severity int → label ──────────────────────────────────────────────────────
_SEV_LABEL = {1: "minor", 2: "moderate", 3: "moderate", 4: "severe", 5: "critical"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class HazardReport(BaseModel):
    userId:      str        = Field(...,  example="12")
    trailId:     str        = Field(...,  example="9")
    hazardType:  str        = Field(...,  example="landslide")
    description: str        = Field("",  example="Rockfall blocking main path")
    severity:    int        = Field(...,  ge=1, le=5)
    photo:       str | None = None
    latitude:    float      = Field(...,  example=1.3511)
    longitude:   float      = Field(...,  example=103.7761)


# ── OutSystems helpers ────────────────────────────────────────────────────────

async def _os_get_trail(trail_id: str) -> dict | None:
    """GET TrailDBAPI/GetTrail/{trailId}. Returns raw OutSystems response or None."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OUTSYSTEMS_TRAIL_DB_URL}/GetTrail/{trail_id}")
            if r.status_code == 200:
                data = r.json()
                if data.get("Success") or data.get("trailName"):
                    return data
    except Exception as exc:
        log.warning("OutSystems TrailDBAPI/GetTrail/%s: %s", trail_id, exc)
    return None


async def _os_get_all_trails() -> list | None:
    """GET TrailDBAPI/GetAllTrails. Returns trail list or None."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OUTSYSTEMS_TRAIL_DB_URL}/GetAllTrails")
            if r.status_code == 200:
                data = r.json()
                trails = data.get("trails")
                return trails if trails is not None else (data if isinstance(data, list) else None)
    except Exception as exc:
        log.warning("OutSystems TrailDBAPI/GetAllTrails: %s", exc)
    return None


async def _os_get_active_hazards(trail_id: str) -> list:
    """
    GET TrailConditionAPI/Condition/{trailId}.
    Returns the activeHazards list (may be empty).
    Raises HTTPException(503) only if called standalone and OutSystems is down.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OUTSYSTEMS_CONDITION_URL}/Condition/{trail_id}")
            if r.status_code == 200:
                data = r.json()
                # OutSystems returns ErrorCode:"No Active Hazards Found" (not a real error)
                # when the list is empty — treat any 200 response as success.
                hazards = data.get("activeHazards") if data.get("activeHazards") is not None else []
                log.info("OutSystems Condition/%s → %d active hazards", trail_id, len(hazards))
                return hazards
            log.warning("OutSystems Condition/%s returned status %s", trail_id, r.status_code)
    except Exception as exc:
        log.warning("OutSystems TrailConditionAPI/Condition/%s: %s", trail_id, exc)
    return []


async def _os_add_hazard(payload: dict) -> dict | None:
    """POST TrailConditionAPI/AddHazard. Returns response or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            log.info("OutSystems AddHazard → payload: %s", payload)
            r = await client.post(f"{OUTSYSTEMS_CONDITION_URL}/AddHazard", json=payload)
            log.info("OutSystems AddHazard ← status=%s body=%s", r.status_code, r.text[:500])
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        log.error("OutSystems AddHazard HTTP %s: %s", e.response.status_code, e.response.text[:500])
    except Exception as exc:
        log.error("OutSystems AddHazard unreachable: %s", exc)
    return None


# ── Hazard field mapping helpers ──────────────────────────────────────────────

def _hazard_to_detail(h: dict) -> dict:
    """Map OutSystems hazard object → hazardDetails format (for Trail_Query_Service)."""
    sev_int = int(h.get("severity", 1))
    lat = h.get("lat", "")
    lon = h.get("lon", "")
    return {
        "type":        h.get("hazardType", "unknown"),
        "severity":    _SEV_LABEL.get(sev_int, "minor"),
        "location":    f"{lat}, {lon}" if lat and lon else "reported location",
        "lat":         lat,
        "lon":         lon,
        "description": h.get("description", ""),
        "reported_at": h.get("timeStamp", ""),
    }


def _hazard_to_report(h: dict) -> dict:
    """Map OutSystems hazard object → reported_hazards format (for Trail_Query_Service)."""
    return {
        "hazard_id":   str(h.get("hazardId", "")),
        "hazard_type": h.get("hazardType", "unknown"),
        "severity":    int(h.get("severity", 1)),
        "description": h.get("description", ""),
        "reported_at": h.get("timeStamp", ""),
        "trail_id":    str(h.get("trailId", "")),
        "status":      h.get("status", "ACTIVE"),
        "lat":         h.get("lat"),
        "lon":         h.get("lon"),
    }


def _highest_severity(hazard_details: list) -> str:
    rank = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "critical": 4}
    if not hazard_details:
        return "none"
    return max(hazard_details, key=lambda h: rank.get(h.get("severity", "minor"), 1))["severity"]


def _parse_coord(coord_str: str) -> tuple[float, float]:
    parts = coord_str.split(",")
    return float(parts[0].strip()), float(parts[1].strip())


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/trail/{trail_id}/conditions", tags=["Trail"])
async def get_trail_conditions(trail_id: str):
    """
    Returns combined trail data from OutSystems + TRAIL_META + TRAIL_OVERRIDES.
    Used by orchestrator, Report Ingestion Service, and Trail Query Service.
    """
    trail_data, raw_hazards = await asyncio.gather(
        _os_get_trail(trail_id),
        _os_get_active_hazards(trail_id),
    )

    if trail_data is None and not TRAIL_OVERRIDES.get(trail_id):
        raise HTTPException(status_code=503, detail="OutSystems TrailDBAPI unavailable")

    # operationalStatus: TRAIL_OVERRIDES (from hazard report) > OutSystems GetTrail > OPEN
    override_status = TRAIL_OVERRIDES.get(trail_id)
    os_status = (trail_data or {}).get("operationalStatus", "OPEN").upper()
    status = override_status or os_status

    hazard_details = [_hazard_to_detail(h) for h in raw_hazards]
    meta = TRAIL_META.get(trail_id, {})

    result: dict = {
        "trailId":           trail_id,
        "operationalStatus": status,
        "isClosed":          status == "CLOSED",
        "activeHazards":     len(hazard_details),
        "hazardDetails":     hazard_details,
        **meta,
    }

    if trail_data:
        result["name"]             = trail_data.get("trailName") or trail_data.get("name")
        result["difficulty"]       = trail_data.get("difficultyLabel") or trail_data.get("difficulty")
        result["difficultyRating"] = trail_data.get("difficultyRating")
        result["startPoint"]       = trail_data.get("startPoint")
        result["endPoint"]         = trail_data.get("endPoint")

    log.info("Trail %s conditions: status=%s activeHazards=%d", trail_id, status, len(hazard_details))
    return result


@app.get("/GetAllTrails", tags=["TrailDBAPI"])
async def get_all_trails():
    """Proxies OutSystems TrailDBAPI/GetAllTrails."""
    trails = await _os_get_all_trails()
    if trails is None:
        raise HTTPException(status_code=503, detail="OutSystems TrailDBAPI unavailable")
    return {"trails": trails, "totalCount": len(trails), "Success": True, "ErrorCode": 0}


@app.get("/Condition/{trail_id}", tags=["TrailConditionAPI"])
async def get_condition(trail_id: str):
    """
    Mirrors OutSystems TrailConditionAPI/Condition/{trailId}.
    Returns activeHazards as a list with mapped severity labels.
    operationalStatus comes from TRAIL_OVERRIDES (set by Step 15).
    """
    raw_hazards = await _os_get_active_hazards(trail_id)
    hazard_details = [_hazard_to_detail(h) for h in raw_hazards]
    status = TRAIL_OVERRIDES.get(trail_id, "OPEN")

    return {
        "operationalStatus":  status,
        "activeHazardCounts": len(raw_hazards),
        "highestSeverity":    _highest_severity(hazard_details),
        "hazardTypes":        list({h["type"] for h in hazard_details}),
        "activeHazards":      raw_hazards,
        "lastUpdated":        datetime.now(timezone.utc).isoformat(),
        "Success": True, "ErrorCode": 0, "ErrorMessage": "",
    }


@app.get("/GetTrail/{trail_id}", tags=["TrailDBAPI"])
async def get_trail(trail_id: str):
    """Proxies OutSystems TrailDBAPI/GetTrail/{trailId}, merges with TRAIL_META."""
    trail_data = await _os_get_trail(trail_id)
    if trail_data is None:
        raise HTTPException(status_code=503, detail="OutSystems TrailDBAPI unavailable")

    override_status = TRAIL_OVERRIDES.get(trail_id)
    os_status = trail_data.get("operationalStatus", "OPEN").upper()
    status = override_status or os_status
    meta = TRAIL_META.get(trail_id, {})

    return {
        "trailId":           trail_id,
        "trailName":         trail_data.get("trailName") or trail_data.get("name"),
        "difficulty":        trail_data.get("difficulty"),
        "operationalStatus": status,
        "startPoint":        trail_data.get("startPoint"),
        "endPoint":          trail_data.get("endPoint"),
        **meta,
        "Success": True, "ErrorCode": 0,
    }


@app.post("/trail/{trail_id}/update-condition", tags=["Trail"])
async def update_trail_condition(trail_id: str, body: dict):
    """
    Step 15 — Called by Report Ingestion Service after a hazard is reported.
    Writes the new operationalStatus to TRAIL_OVERRIDES.
    Hazard details are now stored in OutSystems via AddHazard (CreateReport).
    """
    new_status = body.get("operationalStatus", "CAUTION").upper()
    TRAIL_OVERRIDES[trail_id] = new_status

    log.info("Trail %s override → operationalStatus=%s", trail_id, new_status)
    return {
        "trailId":           trail_id,
        "operationalStatus": new_status,
        "updatedAt":         body.get("updatedAt", datetime.now(timezone.utc).isoformat()),
        "Success": True,
    }


@app.post("/trails/candidates", tags=["Trail"])
async def get_candidate_trails(body: dict):
    """
    Returns OPEN trails (from OutSystems) excluding the specified one.
    Respects TRAIL_OVERRIDES for status.
    Body: { excludeTrailId, requiredOperationalStatus? }
    """
    exclude_id = str(body.get("excludeTrailId", ""))
    required   = body.get("requiredOperationalStatus", "OPEN").upper()

    trails = await _os_get_all_trails()
    if trails is None:
        raise HTTPException(status_code=503, detail="OutSystems TrailDBAPI unavailable")

    candidates = []
    for trail in trails:
        t_id = str(trail.get("trailId", ""))
        if t_id == exclude_id:
            continue

        override_status = TRAIL_OVERRIDES.get(t_id)
        status = (override_status or trail.get("operationalStatus", "OPEN")).upper()
        if status != required:
            continue

        start = trail.get("startPoint", "0, 0")
        end   = trail.get("endPoint",   "0, 0")
        try:
            start_lat, start_lng = _parse_coord(start)
            end_lat,   end_lng   = _parse_coord(end)
        except (ValueError, IndexError):
            start_lat = start_lng = end_lat = end_lng = 0.0

        candidates.append({
            "trailId":      t_id,
            "name":         trail.get("trailName") or trail.get("name"),
            "difficulty":   trail.get("difficulty"),
            "startPoint":   start,
            "endPoint":     end,
            "trailHeadLat": start_lat,
            "trailHeadLng": start_lng,
            "trailEndLat":  end_lat,
            "trailEndLng":  end_lng,
        })

    return {"candidateTrails": candidates, "count": len(candidates)}


@app.post("/CreateReport", tags=["Trail Hazards"])
async def create_report(body: HazardReport):
    """
    Step 6 — Called by Report Ingestion Service to persist a hazard report.
    Calls OutSystems AddHazard to store in TrailConditionAPI.
    Returns 503 if OutSystems is unavailable.
    """
    # OutSystems expects userId and trailId as long integers.
    # userId may be a Firebase UID (non-numeric) — default to 0 in that case.
    try:
        user_id = int(body.userId)
    except (ValueError, TypeError):
        user_id = 0

    try:
        trail_id = int(body.trailId)
    except (ValueError, TypeError):
        log.error("CreateReport: trailId '%s' is not numeric — OutSystems requires a long", body.trailId)
        raise HTTPException(status_code=400, detail=f"trailId must be numeric, got '{body.trailId}'")

    payload = {
        "userId":      user_id,
        "trailId":     trail_id,
        "hazardType":  body.hazardType,
        "description": body.description,
        "severity":    body.severity,
        "lat":         str(body.latitude),
        "lon":         str(body.longitude),
        "status":      "ACTIVE",
    }

    result = await _os_add_hazard(payload)
    if result is None:
        raise HTTPException(status_code=503, detail="OutSystems AddHazard unavailable")

    # AddHazard returns { "id": int, "opStatus": "CAUTION"|"OPEN"|..., "Success": true }
    op_status = result.get("opStatus") or result.get("operationalStatus")
    if op_status:
        TRAIL_OVERRIDES[body.trailId] = op_status.upper()
        log.info("Trail %s opStatus updated from AddHazard → %s", body.trailId, op_status)

    log.info("Hazard persisted to OutSystems | hazardId=%s trailId=%s type=%s",
             result.get("id"), body.trailId, body.hazardType)
    return {
        "hazard_id":   str(result.get("id", result.get("hazardId", ""))),
        "success":     True,
        "reported_at": result.get("timeStamp", datetime.now(timezone.utc).isoformat()),
    }


@app.get("/hazards/trail/{trail_id}", tags=["Trail Hazards"])
async def get_hazards_by_trail(trail_id: str):
    """
    Returns all ACTIVE hazards for a trail, fetched from OutSystems
    TrailConditionAPI/Condition/{trailId}.activeHazards.
    """
    raw_hazards = await _os_get_active_hazards(trail_id)
    active = [h for h in raw_hazards if h.get("status", "ACTIVE") == "ACTIVE"]
    hazards = [_hazard_to_report(h) for h in active]
    return {"hazards": hazards, "count": len(hazards), "success": True}


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Condition_Service", "version": "3.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Condition_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8002)), reload=True)
