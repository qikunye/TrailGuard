"""
TRAILGUARD – Evaluator Wrapper  (LLM Wrapper)
Port: 8006

Accepts a consolidated payload from the Orchestrator, builds a structured
prompt, calls the OpenAI API, and normalises the response into:

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

app = FastAPI(title="TRAILGUARD – Evaluator Wrapper (OpenAI)", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_URL     = "https://api.openai.com/v1/chat/completions"
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
    """Extract JSON from OpenAI response, stripping any markdown fences."""
    clean = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from OpenAI response: {text[:300]}")


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
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured. Set the environment variable."
        )

    prompt = _build_prompt(req)
    log.info("Sending evaluation request to OpenAI model=%s", OPENAI_MODEL)

    openai_body = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You are a trail safety evaluator. Always respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 512,
        "top_p": 0.8,
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(OPENAI_URL, json=openai_body, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            openai_data = resp.json()
        except httpx.HTTPStatusError as e:
            log.error("OpenAI API HTTP error: %s – %s", e.response.status_code, e.response.text)
            raise HTTPException(status_code=502, detail=f"OpenAI API error: {e.response.status_code}")
        except httpx.RequestError as e:
            log.error("OpenAI API connection error: %s", e)
            raise HTTPException(status_code=503, detail="Cannot reach OpenAI API.")

    # Extract text from OpenAI response
    try:
        raw_text = openai_data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        log.error("Unexpected OpenAI response structure: %s", openai_data)
        raise HTTPException(status_code=502, detail=f"Unexpected OpenAI response structure: {e}")

    log.info("OpenAI raw response: %s", raw_text[:200])

    try:
        parsed  = _extract_json(raw_text)
        result  = _normalise(parsed)
    except (ValueError, KeyError) as e:
        log.error("Failed to parse OpenAI response: %s", e)
        raise HTTPException(status_code=502, detail=f"Failed to parse OpenAI response: {e}")

    log.info("Evaluation complete: finalDecision=%s confidence=%.2f",
             result["finalDecision"], result["confidenceScore"])
    return result


@app.get("/health", tags=["Ops"])
async def health():
    openai_configured = bool(OPENAI_API_KEY)
    return {
        "status": "ok",
        "service": "Evaluator_Wrapper",
        "openaiConfigured": openai_configured,
        "model": OPENAI_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Evaluator_Wrapper:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8006)), reload=True)
