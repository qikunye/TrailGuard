"""
TRAILGUARD – Evaluator Wrapper  (LLM Wrapper)
Port: 8006

Accepts the consolidated Swagger-validated payload from the Orchestrator,
builds a structured prompt, calls the OpenAI API, and normalises the response.

Fields accepted in the request schema are ALL Swagger-backed or entry-request
fields. Fields that were in the old implementation but are NOT Swagger-backed
have been removed:
  REMOVED: medicalFlags, injuriesLast30Days, fatalitiesAllTime,
           mostCommonIncidentType, riskScore, riskTier, distanceKm,
           elevationGainM, surfaceState, hazardDetails[]

KEPT (Swagger or entry-request or internal service):
  Hiker  (HikerProfileAPI/Capability):  fitnessLevel, experienceRating,
                                         totalHikesCompleted, typicalPace
  Trail  (TrailConditionAPI/Condition):  operationalStatus, activeHazardCounts,
                                         highestSeverity, hazardTypes
  TrailDB (TrailDBAPI/GetTrail):         trailName, difficulty, operationalStatus
  Incidents (IncidentsAPI/GetRecent):    incidentCount30Days, incidentCount90Days
  Weather (Weather Wrapper, internal):   full weather dict
  Completion (Hike Completion, internal):full completion dict

Output:
{
  finalDecision:   "GO" | "CAUTION" | "DO_NOT_GO"
  reasoning:       "..."
  warnings:        ["...", ...]
  confidenceScore: 0.0–1.0
}
"""

import os
import json
import logging
import re

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

log = logging.getLogger("EvaluatorWrapper")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TRAILGUARD – Evaluator Wrapper (OpenAI)", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_URL     = "https://api.openai.com/v1/chat/completions"
TIMEOUT = httpx.Timeout(30.0, connect=5.0)


# ── Request schema ─────────────────────────────────────────────────────────────
# Only Swagger-backed fields or valid entry-request fields are accepted.

class EvaluationRequest(BaseModel):
    # Entry-request fields (from the assessment form)
    userId:            str
    trailId:           str
    plannedDate:       str
    plannedStartTime:  str
    declaredExpLevel:  str

    # HikerProfileAPI/Capability fields only
    hikerProfile:      dict   # fitnessLevel, experienceRating, totalHikesCompleted, typicalPace

    # Weather Wrapper fields (internal, Open-Meteo backed)
    weatherData:       dict   # temperatureC, feelsLikeC, conditions, severity, safetyFlags, …

    # TrailConditionAPI/Condition fields only
    trailConditions:   dict   # operationalStatus, activeHazardCounts, highestSeverity, hazardTypes

    # TrailDBAPI/GetTrail fields only
    trailMeta:         dict   # trailName, difficulty, operationalStatus

    # IncidentsAPI/GetRecentIncidents fields only (incidentCount per call)
    incidentData:      dict   # incidentCount30Days, incidentCount90Days

    # Hike Completion Service fields (internal)
    completionEstimate: dict  # estimatedDurationHuman, estimatedReturnTime, returnsBeforeSunset

    # Derived: trail closed flag (deterministically derived from operationalStatus)
    isTrailClosed:     bool = False


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_prompt(req: EvaluationRequest) -> str:
    h  = req.hikerProfile
    w  = req.weatherData
    tc = req.trailConditions
    tm = req.trailMeta
    i  = req.incidentData
    ce = req.completionEstimate

    return f"""
You are TRAILGUARD, an expert trail safety AI.
Evaluate whether a hiker should proceed with their planned hike and return a JSON decision.

## Hiker Information
- Declared experience level (self-reported): {req.declaredExpLevel}
- Fitness level (from HikerProfileAPI): {h.get('fitnessLevel', 'unknown')}
- Experience rating (from HikerProfileAPI): {h.get('experienceRating', 'unknown')}
- Total hikes completed (from HikerProfileAPI): {h.get('totalHikesCompleted', 0)}
- Typical pace (from HikerProfileAPI): {h.get('typicalPace', '?')} min/km

## Trail Information (TrailDB + TrailCondition)
- Trail name: {tm.get('trailName', req.trailId)}
- Difficulty: {tm.get('difficulty', '?')} / 5
- Operational status: {tm.get('operationalStatus', 'unknown')}
- Trail closed: {req.isTrailClosed}
- Active hazard count (TrailConditionAPI): {tc.get('activeHazardCounts', 0)}
- Highest hazard severity (TrailConditionAPI): {tc.get('highestSeverity', 'none')}
- Hazard types present (TrailConditionAPI): {tc.get('hazardTypes', [])}

## Weather Forecast (planned start {req.plannedStartTime} on {req.plannedDate})
- Temperature: {w.get('temperatureC', '?')}°C (feels like {w.get('feelsLikeC', '?')}°C)
- Conditions: {w.get('conditions', 'unknown')} (severity: {w.get('severity', 'unknown')})
- Precipitation: {w.get('precipitationMm', 0)} mm
- Wind: {w.get('windSpeedKph', 0)} kph
- UV Index: {w.get('uvIndex', 0)}
- Safety flags: {w.get('safetyFlags', [])}

## Recent Incidents (IncidentsAPI — incidentCount only)
- Incidents in last 30 days: {i.get('incidentCount30Days', 0)}
- Incidents in last 90 days: {i.get('incidentCount90Days', 0)}

## Completion Estimate
- Estimated duration: {ce.get('estimatedDurationHuman', '?')}
- Estimated return time: {ce.get('estimatedReturnTime', '?')}
- Returns before sunset (~18:30): {ce.get('returnsBeforeSunset', True)}

---

Based on ALL of the above, provide your safety assessment.

You MUST respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON.
The JSON must follow this exact structure:

{{
  "finalDecision": "GO" | "CAUTION" | "DO_NOT_GO",
  "reasoning": "One paragraph (3-5 sentences) with the full assessment narrative.",
  "keyReasons": [
    "Concise factor 1 (positive or negative)",
    "Concise factor 2",
    "Concise factor 3"
  ],
  "warnings": ["Actionable safety precaution 1", "Precaution 2"],
  "confidenceScore": 0.0
}}

Field rules:
- reasoning: narrative paragraph explaining the overall decision
- keyReasons: 3–5 SHORT bullet-point factors (weather OK, trail hazard level, hiker capability match, incident count, return-before-dark). Include BOTH positive and negative factors.
- warnings: actionable safety tips / precautions for the hiker (not the same as keyReasons)
- confidenceScore: 0.0–1.0

Rules for finalDecision:
- GO: Conditions are safe, hiker is capable, no significant risks.
- CAUTION: Some risk factors present; hiker may proceed with precautions.
- DO_NOT_GO: Trail is closed, extreme weather, high hazard severity (severe/critical),
             very high incident count (>10 in 30 days), hiker experience well below
             trail difficulty, or estimated return after dark.
""".strip()


# ── Normalisation ──────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    clean = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from OpenAI response: {text[:300]}")


def _normalise(raw: dict) -> dict:
    valid = {"GO", "CAUTION", "DO_NOT_GO"}
    decision = raw.get("finalDecision", "CAUTION").upper().replace(" ", "_")
    if decision not in valid:
        decision = "CAUTION"
    return {
        "finalDecision":   decision,
        "reasoning":       raw.get("reasoning", "No reasoning provided."),
        "keyReasons":      raw.get("keyReasons", []),
        "warnings":        raw.get("warnings", []),
        "confidenceScore": float(raw.get("confidenceScore", 0.75)),
    }


# ── Rule-based fallback (used when OPENAI_API_KEY is not configured) ────────────

def _rule_based_evaluate(req: EvaluationRequest) -> dict:
    """
    Deterministic safety decision derived from Swagger-contract fields only.
    Used as a fallback when OpenAI is not configured so the flow still works.
    """
    tc = req.trailConditions
    w  = req.weatherData
    i  = req.incidentData
    ce = req.completionEstimate
    h  = req.hikerProfile

    severity_rank = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "critical": 4}
    weather_rank  = {"clear": 0, "cloudy": 1, "drizzle": 2, "rain": 3, "storm": 4, "extreme": 5}

    highest_sev   = severity_rank.get(tc.get("highestSeverity", "none"), 0)
    weather_sev   = weather_rank.get(w.get("severity", "clear"), 0)
    incidents_30  = i.get("incidentCount30Days", 0)
    returns_dark  = not ce.get("returnsBeforeSunset", True)
    trail_closed  = req.isTrailClosed

    # DO_NOT_GO conditions
    if (
        trail_closed
        or highest_sev >= 4        # critical
        or weather_sev >= 4        # storm or extreme
        or incidents_30 > 10
    ):
        decision   = "DO_NOT_GO"
        confidence = 0.80
    # CAUTION conditions
    elif (
        highest_sev >= 2           # moderate or severe
        or weather_sev >= 2        # drizzle or worse
        or incidents_30 > 5
        or returns_dark
    ):
        decision   = "CAUTION"
        confidence = 0.70
    else:
        decision   = "GO"
        confidence = 0.72

    reasons = []
    if trail_closed:
        reasons.append("Trail is currently closed")
    if highest_sev >= 3:
        reasons.append(f"High hazard severity on trail ({tc.get('highestSeverity')})")
    elif highest_sev >= 2:
        reasons.append(f"Moderate hazard severity on trail ({tc.get('highestSeverity')})")
    if weather_sev >= 3:
        reasons.append(f"Adverse weather conditions ({w.get('severity')})")
    elif weather_sev == 0:
        reasons.append("Clear weather forecast")
    if incidents_30 > 5:
        reasons.append(f"{incidents_30} incidents in the last 30 days")
    elif incidents_30 <= 2:
        reasons.append(f"Low recent incident count ({incidents_30} in 30 days)")
    if returns_dark:
        reasons.append("Estimated return after dark")
    fitness = h.get("fitnessLevel", "medium")
    if fitness == "high":
        reasons.append("Hiker fitness level: high")
    if not reasons:
        reasons.append("Conditions within acceptable parameters")

    warnings = []
    if w.get("safetyFlags"):
        warnings.extend([f.replace("_", " ").title() for f in w["safetyFlags"]])
    if returns_dark:
        warnings.append("Carry a headlamp — estimated return is after sunset")
    if tc.get("activeHazardCounts", 0) > 0:
        warnings.append(f"Active hazards on trail: {', '.join(tc.get('hazardTypes', []))}")

    note = " (rule-based — set OPENAI_API_KEY for AI evaluation)"
    return {
        "finalDecision":   decision,
        "reasoning":       f"Rule-based assessment{note}. "
                           f"Trail status: {tc.get('operationalStatus', 'open')}, "
                           f"hazard severity: {tc.get('highestSeverity', 'none')}, "
                           f"weather: {w.get('conditions', 'unknown')} ({w.get('severity', 'clear')}), "
                           f"incidents (30d): {incidents_30}.",
        "keyReasons":      reasons[:5],
        "warnings":        warnings,
        "confidenceScore": confidence,
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/evaluate", tags=["Evaluation"])
async def evaluate(req: EvaluationRequest):
    if not OPENAI_API_KEY:
        log.warning("OPENAI_API_KEY not set — using rule-based fallback evaluation")
        return _rule_based_evaluate(req)

    prompt = _build_prompt(req)
    log.info("Sending evaluation to OpenAI model=%s", OPENAI_MODEL)

    openai_body = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You are a trail safety evaluator. Always respond with valid JSON only."},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens":  512,
        "top_p":       0.8,
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type":  "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(OPENAI_URL, json=openai_body, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            openai_data = resp.json()
        except httpx.HTTPStatusError as e:
            log.warning("OpenAI API error (HTTP %s) — using rule-based fallback", e.response.status_code)
            return _rule_based_evaluate(req)
        except httpx.RequestError as e:
            log.warning("OpenAI API unreachable — using rule-based fallback: %s", e)
            return _rule_based_evaluate(req)

    try:
        raw_text = openai_data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        log.error("Unexpected OpenAI response structure: %s", openai_data)
        raise HTTPException(status_code=502, detail=f"Unexpected OpenAI response structure: {e}")

    log.info("OpenAI raw response: %s", raw_text[:200])

    try:
        parsed = _extract_json(raw_text)
        result = _normalise(parsed)
    except (ValueError, KeyError) as e:
        log.error("Failed to parse OpenAI response: %s", e)
        raise HTTPException(status_code=502, detail=f"Failed to parse OpenAI response: {e}")

    log.info("Evaluation complete: finalDecision=%s confidence=%.2f",
             result["finalDecision"], result["confidenceScore"])
    return result


@app.get("/health", tags=["Ops"])
async def health():
    return {
        "status":           "ok",
        "service":          "Evaluator_Wrapper",
        "openaiConfigured": bool(OPENAI_API_KEY),
        "model":            OPENAI_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Evaluator_Wrapper:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8006)), reload=True)
