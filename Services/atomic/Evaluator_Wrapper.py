"""
TRAILGUARD – Evaluator Wrapper  (LLM Wrapper)
Port: 8006

Accepts a consolidated payload from the Orchestrator, builds a structured
prompt, calls the Google Gemini API, and normalises the response into:

{
  finalDecision:  "GO" | "CAUTION" | "DO_NOT_GO"
  reasoning:      "..."   (concise paragraph)
  warnings:       ["...", "..."]
  confidenceScore: 0.0–1.0
}
"""

import os
import json
import logging
import re
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

log = logging.getLogger("EvaluatorWrapper")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TRAILGUARD – Evaluator Wrapper (Gemini)", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_URL     = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
)
TIMEOUT = httpx.Timeout(30.0, connect=5.0)

# ── Request schema ────────────────────────────────────────────────────────────

class EvaluationRequest(BaseModel):
    userId:              str
    trailId:             str
    plannedDate:         str
    plannedStartTime:    str
    declaredExpLevel:    str
    hikerProfile:        dict
    weatherData:         dict
    trailConditions:     dict
    incidentRisk:        dict
    completionEstimate:  dict

# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_prompt(req: EvaluationRequest) -> str:
    return f"""
You are TRAILGUARD, an expert trail safety AI for the platform TRAILGUARD.
Your task: evaluate whether a hiker should proceed with their planned hike
and return a structured JSON decision.

## Hiker Information
- Declared experience level: {req.declaredExpLevel}
- Fitness level (from profile): {req.hikerProfile.get('fitnessLevel', 'unknown')}
- Experience tier (from profile): {req.hikerProfile.get('experienceTier', 'unknown')}
- Completed hikes: {req.hikerProfile.get('completedHikes', 0)}
- Medical flags: {req.hikerProfile.get('medicalFlags', [])}

## Trail Information
- Trail: {req.trailConditions.get('name', req.trailId)}
- Distance: {req.trailConditions.get('distanceKm', '?')} km
- Elevation gain: {req.trailConditions.get('elevationGainM', '?')} m
- Difficulty rating: {req.trailConditions.get('difficultyRating', '?')} / 5
- Surface state: {req.trailConditions.get('surfaceState', 'unknown')}
- Active hazards: {req.trailConditions.get('activeHazards', 0)}
- Trail is closed: {req.trailConditions.get('isClosed', False)}

## Weather Forecast (planned start {req.plannedStartTime} on {req.plannedDate})
- Temperature: {req.weatherData.get('temperatureC', '?')}°C
  (Feels like: {req.weatherData.get('feelsLikeC', '?')}°C)
- Conditions: {req.weatherData.get('conditions', 'unknown')} ({req.weatherData.get('severity', 'unknown')})
- Precipitation: {req.weatherData.get('precipitationMm', 0)} mm
- Wind: {req.weatherData.get('windSpeedKph', 0)} kph
- UV Index: {req.weatherData.get('uvIndex', 0)}
- Safety flags: {req.weatherData.get('safetyFlags', [])}

## Incident Risk
- Risk score: {req.incidentRisk.get('riskScore', '?')} / 100
- Risk tier: {req.incidentRisk.get('riskTier', 'unknown')}
- Incidents (last 30 days): {req.incidentRisk.get('incidentsLast30Days', 0)}
- Injuries (last 30 days): {req.incidentRisk.get('injuriesLast30Days', 0)}
- Most common incident: {req.incidentRisk.get('mostCommonIncidentType', 'unknown')}

## Completion Estimate
- Estimated duration: {req.completionEstimate.get('estimatedDurationHuman', '?')}
- Estimated return time: {req.completionEstimate.get('estimatedReturnTime', '?')}
- Returns before sunset (18:30): {req.completionEstimate.get('returnsBeforeSunset', True)}

---

Based on ALL of the above, provide your safety assessment.

You MUST respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON.
The JSON must follow this exact structure:

{{
  "finalDecision": "GO" | "CAUTION" | "DO_NOT_GO",
  "reasoning": "One paragraph (3-5 sentences) explaining the decision.",
  "warnings": ["Warning 1", "Warning 2"],
  "confidenceScore": 0.0
}}

Rules for finalDecision:
- GO: Conditions are safe, hiker is capable, no significant risks.
- CAUTION: Some risk factors present; hiker may proceed with precautions.
- DO_NOT_GO: Serious risks (closed trail, extreme weather, critical risk score, 
              hiker experience well below trail difficulty, return after dark).
""".strip()

# ── Normalisation ──────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Extract JSON from Gemini response, stripping any markdown fences."""
    # Remove ```json ... ``` wrappers if present
    clean = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Try to locate JSON object via regex as fallback
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from Gemini response: {text[:300]}")


def _normalise(raw: dict) -> dict:
    """Ensure finalDecision is one of the valid values."""
    valid = {"GO", "CAUTION", "DO_NOT_GO"}
    decision = raw.get("finalDecision", "CAUTION").upper().replace(" ", "_")
    if decision not in valid:
        decision = "CAUTION"
    return {
        "finalDecision":   decision,
        "reasoning":       raw.get("reasoning", "No reasoning provided."),
        "warnings":        raw.get("warnings", []),
        "confidenceScore": float(raw.get("confidenceScore", 0.75)),
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/evaluate", tags=["Evaluation"])
async def evaluate(req: EvaluationRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured. Set the environment variable."
        )

    prompt = _build_prompt(req)
    log.info("Sending evaluation request to Gemini model=%s", GEMINI_MODEL)

    gemini_body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature":     0.2,    # low temp for deterministic safety decisions
            "maxOutputTokens": 512,
            "topP":            0.8,
        },
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(GEMINI_URL, json=gemini_body, timeout=TIMEOUT)
            resp.raise_for_status()
            gemini_data = resp.json()
        except httpx.HTTPStatusError as e:
            log.error("Gemini API HTTP error: %s – %s", e.response.status_code, e.response.text)
            raise HTTPException(status_code=502, detail=f"Gemini API error: {e.response.status_code}")
        except httpx.RequestError as e:
            log.error("Gemini API connection error: %s", e)
            raise HTTPException(status_code=503, detail="Cannot reach Gemini API.")

    # Extract text from Gemini response
    try:
        raw_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        log.error("Unexpected Gemini response structure: %s", gemini_data)
        raise HTTPException(status_code=502, detail=f"Unexpected Gemini response structure: {e}")

    log.info("Gemini raw response: %s", raw_text[:200])

    try:
        parsed  = _extract_json(raw_text)
        result  = _normalise(parsed)
    except (ValueError, KeyError) as e:
        log.error("Failed to parse Gemini response: %s", e)
        raise HTTPException(status_code=502, detail=f"Failed to parse Gemini response: {e}")

    log.info("Evaluation complete: finalDecision=%s confidence=%.2f",
             result["finalDecision"], result["confidenceScore"])
    return result


@app.get("/health", tags=["Ops"])
async def health():
    gemini_configured = bool(GEMINI_API_KEY)
    return {
        "status": "ok",
        "service": "Evaluator_Wrapper",
        "geminiConfigured": gemini_configured,
        "model": GEMINI_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Evaluator_Wrapper:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8006)), reload=True)
