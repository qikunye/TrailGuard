"""
TRAILGUARD – Trail Safety Assessment Orchestrator
Scenario 1: Stateless Composite Orchestration

Swagger-contract calls (source of truth):
  Step 1: GET /Capability/{userId}           → HikerProfileAPI
  Step 2: GET /weather                       → Weather Wrapper (internal, no Swagger)
  Step 3: GET /Condition/{trailId}           → TrailConditionAPI
  Step 4: GET /GetTrail/{trailId}            → TrailDBAPI
  Step 5: GET /GetRecentIncidents/{id}/30    → IncidentsAPI (30-day count)
  Step 6: GET /GetRecentIncidents/{id}/90    → IncidentsAPI (90-day count)
  Step 7: POST /estimate                     → Hike Completion Service (internal)
  Step 8: POST /evaluate                     → Evaluator Wrapper (internal, OpenAI)

Steps 2-6 are fired concurrently. Step 7 depends on 2-4. Step 8 depends on all.

Field-validity rule: only fields returned by a Swagger method, the entry request,
or deterministically derived from those are forwarded downstream.

Unsupported fields REMOVED vs the original implementation:
  - medicalFlags          (not in HikerProfileAPI/Capability)
  - emergencyContact      (not in HikerProfileAPI/Capability)
  - name (hiker)          (not in HikerProfileAPI/Capability)
  - injuriesLast30Days    (not in IncidentsAPI/GetRecentIncidents)
  - fatalitiesAllTime     (not in IncidentsAPI/GetRecentIncidents)
  - mostCommonIncidentType(not in IncidentsAPI/GetRecentIncidents)
  - riskScore             (not in IncidentsAPI/GetRecentIncidents)
  - riskTier              (not in IncidentsAPI/GetRecentIncidents)
  - lastIncidentDate      (not in IncidentsAPI/GetRecentIncidents)
  - searchAndRescueCallouts (not in any Swagger endpoint)
  - distanceKm            (not in TrailDBAPI/GetTrail or TrailConditionAPI/Condition)
  - elevationGainM        (not in any Swagger endpoint)
  - surfaceState          (not in TrailConditionAPI/Condition)
  - hazardDetails[]       (not in TrailConditionAPI/Condition — only hazardTypes[])
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TrailSafetyOrchestrator")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TRAILGUARD – Trail Safety Assessment Orchestrator",
    version="2.0.0",
    description="Stateless composite orchestration. All fields validated against Swagger contracts.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service URLs (override via environment variables) ────────────────────────
HIKER_PROFILE_URL     = os.getenv("HIKER_PROFILE_URL",     "http://localhost:8001")
TRAIL_CONDITION_URL   = os.getenv("TRAIL_CONDITION_URL",   "http://localhost:8002")
INCIDENT_RISK_URL     = os.getenv("INCIDENT_RISK_URL",     "http://localhost:8003")
HIKE_COMPLETION_URL   = os.getenv("HIKE_COMPLETION_URL",   "http://localhost:8004")
WEATHER_WRAPPER_URL   = os.getenv("WEATHER_WRAPPER_URL",   "http://localhost:8005")
EVALUATOR_WRAPPER_URL = os.getenv("EVALUATOR_WRAPPER_URL", "http://localhost:8006")

# OutSystems HikerProfileAPI — source of truth for userId
OUTSYSTEMS_HIKER_URL  = os.getenv(
    "OUTSYSTEMS_HIKER_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/HikerProfileAPI",
)

TIMEOUT = httpx.Timeout(15.0, connect=5.0)


# ── Request / Response schemas ───────────────────────────────────────────────

class AssessmentRequest(BaseModel):
    userId:            str = Field(..., example="usr_001")
    trailId:           str = Field(..., example="trail_mt_kinabalu")
    plannedDate:       str = Field(..., example="2025-08-15")
    plannedStartTime:  str = Field(..., example="06:30")
    declaredExpLevel:  str = Field(..., example="intermediate",
                                   description="beginner | intermediate | advanced | expert")


class AssessmentResponse(BaseModel):
    requestId:          str
    userId:             str
    trailId:            str
    plannedDate:        str
    plannedStartTime:   str
    # hikerProfile: only Swagger-contract fields from HikerProfileAPI/Capability
    hikerProfile:       dict
    # weatherData: fields from Weather Wrapper (internal service, Open-Meteo)
    weatherData:        dict
    # trailConditions: Swagger fields from TrailConditionAPI/Condition
    trailConditions:    dict
    # trailMeta: Swagger fields from TrailDBAPI/GetTrail
    trailMeta:          dict
    # incidentData: Swagger fields from IncidentsAPI/GetRecentIncidents
    incidentData:       dict
    completionEstimate: dict
    finalDecision:      str           # GO | CAUTION | DO_NOT_GO
    confidenceScore:    float         # 0.0–1.0 from Evaluator
    reasoning:          str
    keyReasons:         list[str]     # 3-5 short bullet factors from Evaluator
    warnings:           list[str]
    evaluatedAt:        str


# ── HTTP helpers ──────────────────────────────────────────────────────────────

async def _get(client: httpx.AsyncClient, url: str, params: dict = None) -> dict:
    try:
        resp = await client.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        log.error("Upstream HTTP error from %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream error from {url}: {e.response.status_code}")
    except httpx.RequestError as e:
        log.error("Connection error to %s: %s", url, e)
        raise HTTPException(status_code=503, detail=f"Cannot reach service at {url}")


async def _post(client: httpx.AsyncClient, url: str, payload: dict) -> dict:
    try:
        resp = await client.post(url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        log.error("Upstream HTTP error from %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream error from {url}: {e.response.status_code}")
    except httpx.RequestError as e:
        log.error("Connection error to %s: %s", url, e)
        raise HTTPException(status_code=503, detail=f"Cannot reach service at {url}")


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/assess-trail", response_model=AssessmentResponse, tags=["Assessment"])
async def assess_trail(req: AssessmentRequest):
    """
    Orchestrates a full trail safety assessment.
    All downstream calls use Swagger-contract endpoints only.
    This endpoint is STATELESS — nothing is persisted.
    """
    request_id = str(uuid.uuid4())
    log.info("▶ Assessment started | requestId=%s userId=%s trailId=%s",
             request_id, req.userId, req.trailId)

    async with httpx.AsyncClient() as client:

        # ── Step 1: HikerProfileAPI / Capability ─────────────────────────────
        # Swagger: GET /HikerProfileService/rest/HikerProfileAPI/Capability/{userId}
        # Returns: fitnessLevel, experienceRating, totalHikesCompleted, typicalPace
        log.info("Step 1 – HikerProfileAPI/Capability userId=%s", req.userId)
        hiker_raw = await _get(client, f"{HIKER_PROFILE_URL}/Capability/{req.userId}")

        if not hiker_raw.get("Success", True):
            # Hiker not in DB (container may have restarted). Derive from declaredExpLevel.
            log.warning("Hiker '%s' not in profile DB — using declaredExpLevel '%s' as fallback",
                        req.userId, req.declaredExpLevel)
            _fitness_map = {"beginner": "low", "intermediate": "medium", "advanced": "high", "expert": "high"}
            hiker_raw = {
                "fitnessLevel":        _fitness_map.get(req.declaredExpLevel, "medium"),
                "experienceRating":    req.declaredExpLevel,
                "totalHikesCompleted": 0,
                "typicalPace":         15,
                "Success":             True,
                "ErrorCode":           0,
            }

        # Strict: keep only Swagger-contract fields
        hiker_profile = {
            "fitnessLevel":        hiker_raw.get("fitnessLevel"),
            "experienceRating":    hiker_raw.get("experienceRating"),
            "totalHikesCompleted": hiker_raw.get("totalHikesCompleted"),
            "typicalPace":         hiker_raw.get("typicalPace"),
        }
        log.info("Step 1 ✓ hiker=%s", hiker_profile)

        # ── Steps 2-6: Concurrent I/O-bound calls ────────────────────────────
        log.info("Steps 2-6 – Concurrent fetch: weather, conditions, trail meta, incidents×2")

        weather_task     = _get(client, f"{WEATHER_WRAPPER_URL}/weather",
                                params={"trailId": req.trailId,
                                        "date":    req.plannedDate,
                                        "time":    req.plannedStartTime})
        # Swagger: GET /HikerProfileService/rest/TrailConditionAPI/Condition/{trailId}
        condition_task   = _get(client, f"{TRAIL_CONDITION_URL}/Condition/{req.trailId}")
        # Swagger: GET /HikerProfileService/rest/TrailDBAPI/GetTrail/{trailId}
        trail_meta_task  = _get(client, f"{TRAIL_CONDITION_URL}/GetTrail/{req.trailId}")
        # Swagger: GET /HikerProfileService/rest/IncidentsAPI/GetRecentIncidents/{id}/{days}
        incidents_30_task = _get(client, f"{INCIDENT_RISK_URL}/GetRecentIncidents/{req.trailId}/30")
        incidents_90_task = _get(client, f"{INCIDENT_RISK_URL}/GetRecentIncidents/{req.trailId}/90")

        (
            weather_data,
            condition_raw,
            trail_meta_raw,
            incidents_30_raw,
            incidents_90_raw,
        ) = await asyncio.gather(
            weather_task,
            condition_task,
            trail_meta_task,
            incidents_30_task,
            incidents_90_task,
        )
        log.info("Steps 2-6 ✓")

        # Strict: keep only Swagger-contract fields for each response

        # TrailConditionAPI/Condition fields
        trail_conditions = {
            "operationalStatus":  condition_raw.get("operationalStatus"),
            "activeHazardCounts": condition_raw.get("activeHazardCounts"),
            "highestSeverity":    condition_raw.get("highestSeverity"),
            "hazardTypes":        condition_raw.get("hazardTypes", []),
        }

        # TrailDBAPI/GetTrail fields
        trail_meta = {
            "trailId":           trail_meta_raw.get("trailId"),
            "trailName":         trail_meta_raw.get("trailName"),
            "difficulty":        trail_meta_raw.get("difficulty"),
            "operationalStatus": trail_meta_raw.get("operationalStatus"),
        }

        # IncidentsAPI/GetRecentIncidents fields — incidentCount only per Swagger
        incident_data = {
            "incidentCount30Days": incidents_30_raw.get("incidentCount", 0),
            "incidentCount90Days": incidents_90_raw.get("incidentCount", 0),
        }
        log.info("Steps 2-6 ✓ conditions=%s trail=%s incidents=%s",
                 trail_conditions, trail_meta, incident_data)

        # Guard: closed trail → force DO_NOT_GO early
        is_closed = (
            trail_conditions.get("operationalStatus") == "closed"
            or trail_meta.get("operationalStatus") == "closed"
        )

        # ── Step 7: Hike Completion Service ──────────────────────────────────
        log.info("Step 7 – Hike completion estimate")
        completion_estimate = await _post(
            client,
            f"{HIKE_COMPLETION_URL}/estimate",
            payload={
                "trailId":          req.trailId,
                "plannedStartTime": req.plannedStartTime,
                # Pass only fields the completion service reads:
                #   hikerProfile.fitnessLevel  (Swagger-backed)
                #   trailConditions.highestSeverity + activeHazardCounts (Swagger-backed)
                #   weatherData.severity  (Weather Wrapper internal field)
                "hikerProfile":    hiker_profile,
                "trailConditions": trail_conditions,
                "weatherData":     weather_data,
            },
        )
        log.info("Step 7 ✓ estimate=%s", completion_estimate)

        # ── Step 8: Evaluator Wrapper (OpenAI) ───────────────────────────────
        log.info("Step 8 – AI evaluation")
        evaluator_payload = {
            "userId":             req.userId,
            "trailId":            req.trailId,
            "plannedDate":        req.plannedDate,
            "plannedStartTime":   req.plannedStartTime,
            "declaredExpLevel":   req.declaredExpLevel,
            # Swagger-backed hiker fields only
            "hikerProfile":       hiker_profile,
            # Weather Wrapper fields (internal service)
            "weatherData":        weather_data,
            # Swagger-backed trail fields
            "trailConditions":    trail_conditions,
            "trailMeta":          trail_meta,
            # Swagger-backed incident fields (incidentCount only)
            "incidentData":       incident_data,
            "completionEstimate": completion_estimate,
            "isTrailClosed":      is_closed,
        }
        evaluation = await _post(
            client,
            f"{EVALUATOR_WRAPPER_URL}/evaluate",
            payload=evaluator_payload,
        )
        log.info("Step 8 ✓ finalDecision=%s", evaluation.get("finalDecision"))

    # ── Step 9: Build and return final response ───────────────────────────────
    # Override decision if trail is closed regardless of AI output
    final_decision = evaluation.get("finalDecision", "CAUTION")
    if is_closed and final_decision != "DO_NOT_GO":
        final_decision = "DO_NOT_GO"
        evaluation.setdefault("warnings", [])
        if "Trail is closed." not in evaluation["warnings"]:
            evaluation["warnings"].insert(0, "Trail is closed.")

    response = AssessmentResponse(
        requestId=          request_id,
        userId=             req.userId,
        trailId=            req.trailId,
        plannedDate=        req.plannedDate,
        plannedStartTime=   req.plannedStartTime,
        hikerProfile=       hiker_profile,
        weatherData=        weather_data,
        trailConditions=    trail_conditions,
        trailMeta=          trail_meta,
        incidentData=       incident_data,
        completionEstimate= completion_estimate,
        finalDecision=      final_decision,
        confidenceScore=    float(evaluation.get("confidenceScore", 0.75)),
        reasoning=          evaluation.get("reasoning", ""),
        keyReasons=         evaluation.get("keyReasons", []),
        warnings=           evaluation.get("warnings", []),
        evaluatedAt=        datetime.utcnow().isoformat() + "Z",
    )
    log.info("◀ Assessment complete | requestId=%s decision=%s",
             request_id, response.finalDecision)
    return response


# ── Profile proxy endpoints (frontend calls API_BASE = port 8000) ─────────────
# These thin proxies let the frontend talk to HikerProfile through one port.

@app.post("/hiker-profile", tags=["Profile"])
async def create_hiker_profile(body: dict):
    """
    Dual-write: POST /AddUser to OutSystems (source of truth) then mirror to local mock.
    OutSystems returns the canonical userId; the same userId is stored in the local mock
    so both systems stay in sync and container restarts don't orphan the profile.
    """
    async with httpx.AsyncClient() as client:

        # ── 1. Write to OutSystems (primary) ─────────────────────────────────
        # OutSystems requires Title-cased fitnessLevel: "Low" | "Medium" | "High"
        os_body = dict(body)
        if os_body.get("fitnessLevel"):
            os_body["fitnessLevel"] = os_body["fitnessLevel"].capitalize()

        outsystems_userId = None
        try:
            os_resp = await client.post(
                f"{OUTSYSTEMS_HIKER_URL}/AddUser",
                json=os_body,
                timeout=TIMEOUT,
            )
            if os_resp.is_success:
                os_data = os_resp.json()
                if os_data.get("Success") and os_data.get("userId") is not None:
                    outsystems_userId = str(os_data["userId"])   # OS returns an integer
                    log.info("OutSystems AddUser ✓ userId=%s", outsystems_userId)
                else:
                    log.warning("OutSystems AddUser error: %s", os_data)
            else:
                log.warning("OutSystems AddUser returned %s: %s", os_resp.status_code, os_resp.text)
        except Exception as e:
            log.warning("OutSystems AddUser unreachable: %s", e)

        # ── 2. Mirror to local mock using OutSystems' userId as canonical ID ──
        local_body = dict(body)
        if outsystems_userId:
            local_body["userId"] = outsystems_userId

        local_result = await _post(client, f"{HIKER_PROFILE_URL}/AddUser", payload=local_body)

        # Return with OutSystems' userId if available, otherwise local ID
        if outsystems_userId:
            return {"userId": outsystems_userId, "Success": True, "ErrorCode": 0, "ErrorMessage": ""}
        return local_result


@app.put("/hiker-profile/{user_id}", tags=["Profile"])
async def update_hiker_profile(user_id: str, body: dict):
    """
    Dual-write: PUT /Update/{userId} to OutSystems then to local mock.
    If the user doesn't exist in OutSystems yet (e.g. usr_xxx legacy ID),
    falls back to AddUser and returns the new OutSystems userId so the
    frontend can update localStorage with the canonical integer ID.
    """
    async with httpx.AsyncClient() as client:

        # OutSystems requires Title-cased fitnessLevel
        os_body = dict(body)
        if os_body.get("fitnessLevel"):
            os_body["fitnessLevel"] = os_body["fitnessLevel"].capitalize()

        new_os_user_id = None

        # ── 1. Try OutSystems Update ──────────────────────────────────────────
        os_updated = False
        try:
            os_resp = await client.put(
                f"{OUTSYSTEMS_HIKER_URL}/Update/{user_id}",
                json=os_body, timeout=TIMEOUT,
            )
            if os_resp.is_success:
                os_data = os_resp.json()
                if os_data.get("Success"):
                    os_updated = True
                    log.info("OutSystems Update ✓ userId=%s", user_id)
                else:
                    log.warning("OutSystems Update non-success for userId=%s: %s", user_id, os_data)
            else:
                log.warning("OutSystems Update HTTP %s for userId=%s", os_resp.status_code, user_id)
        except Exception as e:
            log.warning("OutSystems Update unreachable: %s", e)

        # ── 2. If Update failed, user isn't in OS yet — call AddUser ─────────
        if not os_updated:
            try:
                add_resp = await client.post(
                    f"{OUTSYSTEMS_HIKER_URL}/AddUser",
                    json=os_body, timeout=TIMEOUT,
                )
                if add_resp.is_success:
                    add_data = add_resp.json()
                    if add_data.get("Success") and add_data.get("userId") is not None:
                        new_os_user_id = str(add_data["userId"])
                        log.info("OutSystems AddUser fallback ✓ new userId=%s (was %s)", new_os_user_id, user_id)
            except Exception as e:
                log.warning("OutSystems AddUser fallback failed: %s", e)

        # ── 3. Update local mock under the existing userId ────────────────────
        try:
            await client.put(f"{HIKER_PROFILE_URL}/Update/{user_id}", json=body, timeout=TIMEOUT)
        except Exception:
            pass

        # ── 4. If OS gave us a new integer userId, seed local mock under it ───
        if new_os_user_id:
            local_body = dict(body)
            local_body["userId"] = new_os_user_id
            await _post(client, f"{HIKER_PROFILE_URL}/AddUser", payload=local_body)
            # Return new userId so frontend can update localStorage
            return {"userId": new_os_user_id, "Success": True, "ErrorCode": 0, "ErrorMessage": ""}

        return {"Success": True, "ErrorCode": 0, "ErrorMessage": ""}


@app.get("/hiker-profile/{user_id}", tags=["Profile"])
async def get_hiker_profile_capability(user_id: str):
    """
    Proxy: GET /Capability/{userId} on HikerProfile atomic service.
    Returns: fitnessLevel, experienceRating, totalHikesCompleted, typicalPace
    """
    async with httpx.AsyncClient() as client:
        return await _get(client, f"{HIKER_PROFILE_URL}/Capability/{user_id}")


# ── Trail list proxy (for frontend dropdown) ──────────────────────────────────

@app.get("/trails", tags=["Trails"])
async def get_all_trails():
    """
    Proxy: GET /GetAllTrails on Trail Condition atomic service.
    Returns summary list of trails for the registration dropdown.
    Fields: trailId, trailName, difficulty, operationalStatus (Swagger-aligned).
    """
    async with httpx.AsyncClient() as client:
        return await _get(client, f"{TRAIL_CONDITION_URL}/GetAllTrails")


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Safety_Assessment_Service", "version": "2.0.0"}


# ── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Safety_Assessment_Service:app", host="0.0.0.0", port=8000, reload=True)
