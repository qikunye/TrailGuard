"""
TRAILGUARD – Trail Safety Assessment Orchestrator
Scenario 1: Stateless Composite Orchestration

Flow:
  POST /assess-trail
    1. Validate User   → Hiker Profile Service
    2. Fetch Weather   → Weather Wrapper
    3. Check Hazards   → Trail Condition Service
    4. Analyse Risk    → Incident Risk Service
    5. Estimate Time   → Hike Completion Service
    6. AI Evaluation   → Evaluator Wrapper  (Gemini)
    7. Return JSON     → UI
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TrailSafetyOrchestrator")

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TRAILGUARD – Trail Safety Assessment Orchestrator",
    version="1.0.0",
    description="Stateless composite orchestration for trail safety evaluation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production / via Kong
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service URLs (override via environment variables in production) ───────────
import os

HIKER_PROFILE_URL    = os.getenv("HIKER_PROFILE_URL",    "http://localhost:8001")
TRAIL_CONDITION_URL  = os.getenv("TRAIL_CONDITION_URL",  "http://localhost:8002")
INCIDENT_RISK_URL    = os.getenv("INCIDENT_RISK_URL",    "http://localhost:8003")
HIKE_COMPLETION_URL  = os.getenv("HIKE_COMPLETION_URL",  "http://localhost:8004")
WEATHER_WRAPPER_URL  = os.getenv("WEATHER_WRAPPER_URL",  "http://localhost:8005")
EVALUATOR_WRAPPER_URL= os.getenv("EVALUATOR_WRAPPER_URL","http://localhost:8006")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# ── Request / Response schemas ───────────────────────────────────────────────

class AssessmentRequest(BaseModel):
    userId:            str  = Field(..., example="usr_001")
    trailId:           str  = Field(..., example="trail_mt_kinabalu")
    plannedDate:       str  = Field(..., example="2025-08-15")
    plannedStartTime:  str  = Field(..., example="06:30")
    declaredExpLevel:  str  = Field(..., example="intermediate",
                                    description="beginner | intermediate | advanced | expert")


class AssessmentResponse(BaseModel):
    requestId:       str
    userId:          str
    trailId:         str
    plannedDate:     str
    plannedStartTime:str
    hikerProfile:    dict
    weatherData:     dict
    trailConditions: dict
    incidentRisk:    dict
    completionEstimate: dict
    finalDecision:   str          # GO | CAUTION | DO_NOT_GO
    reasoning:       str
    warnings:        list[str]
    evaluatedAt:     str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get(client: httpx.AsyncClient, url: str, params: dict = None) -> dict:
    """GET with structured error handling."""
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
    """POST with structured error handling."""
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
    Orchestrates a full trail safety assessment across all downstream services.
    This endpoint is STATELESS – nothing is persisted.
    """
    import uuid
    request_id = str(uuid.uuid4())
    log.info("▶ Assessment started | requestId=%s userId=%s trailId=%s",
             request_id, req.userId, req.trailId)

    async with httpx.AsyncClient() as client:

        # ── Step 1: Validate User via Hiker Profile Service ──────────────────
        log.info("Step 1 – Fetching hiker profile for userId=%s", req.userId)
        hiker_profile = await _get(
            client,
            f"{HIKER_PROFILE_URL}/hiker/{req.userId}",
        )
        # Guard: if the user profile is not found the service returns 404,
        # which _get() will surface as a 502. You can add custom logic here.
        log.info("Step 1 ✓ hikerProfile=%s", hiker_profile)

        # ── Steps 2-4: Concurrent I/O-bound calls ────────────────────────────
        # Weather, Trail Conditions and Incident Risk do not depend on each
        # other so we fire them concurrently to reduce total latency.
        log.info("Steps 2-4 – Concurrent fetch: weather, trail conditions, incident risk")
        weather_task    = _get(client, f"{WEATHER_WRAPPER_URL}/weather",
                               params={"trailId": req.trailId, "date": req.plannedDate,
                                       "time": req.plannedStartTime})
        conditions_task = _get(client, f"{TRAIL_CONDITION_URL}/trail/{req.trailId}/conditions")
        risk_task       = _get(client, f"{INCIDENT_RISK_URL}/risk/{req.trailId}")

        weather_data, trail_conditions, incident_risk = await asyncio.gather(
            weather_task, conditions_task, risk_task
        )
        log.info("Steps 2-4 ✓ weather=%s conditions=%s risk=%s",
                 weather_data, trail_conditions, incident_risk)

        # ── Step 5: Estimate Completion Time ─────────────────────────────────
        log.info("Step 5 – Estimating hike completion time")
        completion_estimate = await _post(
            client,
            f"{HIKE_COMPLETION_URL}/estimate",
            payload={
                "trailId":         req.trailId,
                "hikerProfile":    hiker_profile,
                "plannedStartTime":req.plannedStartTime,
                "trailConditions": trail_conditions,
                "weatherData":     weather_data,
            },
        )
        log.info("Step 5 ✓ completionEstimate=%s", completion_estimate)

        # ── Step 6: AI Evaluation via Evaluator Wrapper ───────────────────────
        log.info("Step 6 – Sending consolidated payload to Evaluator Wrapper (Gemini)")
        evaluator_payload = {
            "userId":              req.userId,
            "trailId":             req.trailId,
            "plannedDate":         req.plannedDate,
            "plannedStartTime":    req.plannedStartTime,
            "declaredExpLevel":    req.declaredExpLevel,
            "hikerProfile":        hiker_profile,
            "weatherData":         weather_data,
            "trailConditions":     trail_conditions,
            "incidentRisk":        incident_risk,
            "completionEstimate":  completion_estimate,
        }
        evaluation = await _post(
            client,
            f"{EVALUATOR_WRAPPER_URL}/evaluate",
            payload=evaluator_payload,
        )
        log.info("Step 6 ✓ finalDecision=%s", evaluation.get("finalDecision"))

    # ── Step 7: Build and return final response ───────────────────────────────
    response = AssessmentResponse(
        requestId=          request_id,
        userId=             req.userId,
        trailId=            req.trailId,
        plannedDate=        req.plannedDate,
        plannedStartTime=   req.plannedStartTime,
        hikerProfile=       hiker_profile,
        weatherData=        weather_data,
        trailConditions=    trail_conditions,
        incidentRisk=       incident_risk,
        completionEstimate= completion_estimate,
        finalDecision=      evaluation.get("finalDecision", "CAUTION"),
        reasoning=          evaluation.get("reasoning", ""),
        warnings=           evaluation.get("warnings", []),
        evaluatedAt=        datetime.utcnow().isoformat() + "Z",
    )
    log.info("◀ Assessment complete | requestId=%s decision=%s",
             request_id, response.finalDecision)
    return response


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Safety_Assessment_Service", "version": "1.0.0"}


# ── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Safety_Assessment_Service:app", host="0.0.0.0", port=8000, reload=True)
