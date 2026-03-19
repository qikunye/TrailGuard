"""
TRAILGUARD – Hike Completion Service  (Atomic)
Port: 8004

Estimates completion time using historical completion records for the trail
combined with the individual hiker's fitness profile and current conditions.

Algorithm:
  base_time      = median of historical completions for this trail
  fitness_factor = adjustment based on hiker fitness level
  condition_factor = adjustment based on surface state and active hazards
  weather_factor = adjustment based on weather severity
  estimated_time = base_time × fitness_factor × condition_factor × weather_factor

  estimated_return = plannedStartTime + estimated_time
  safety_window    = check if return time is before sunset
"""

import os
from datetime import datetime, timedelta
from statistics import median
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="TRAILGUARD – Hike Completion Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Historical completion records (minutes) ──────────────────────────────────
# In production this would be a database query.
HISTORICAL_RECORDS: dict[str, list[int]] = {
    "trail_mt_kinabalu": [
        # Minutes taken by previous hikers (round-trip)
        480, 510, 420, 540, 390, 600, 450, 480, 525, 465,
        510, 570, 440, 490, 505, 480, 620, 415, 530, 470,
    ],
    "trail_jungle_loop": [
        90, 100, 80, 110, 95, 105, 85, 115, 88, 92,
        98, 102, 78, 108, 96, 89, 112, 83, 107, 94,
    ],
}

# ── Adjustment factors ───────────────────────────────────────────────────────
FITNESS_FACTORS: dict[str, float] = {
    "high":   0.85,
    "medium": 1.00,
    "low":    1.25,
}

SURFACE_FACTORS: dict[str, float] = {
    "dry":  1.00,
    "damp": 1.08,
    "wet":  1.20,
    "icy":  1.45,
}

# ── Request schema ────────────────────────────────────────────────────────────

class CompletionRequest(BaseModel):
    trailId:          str
    plannedStartTime: str          # "HH:MM"
    hikerProfile:     dict
    trailConditions:  dict
    weatherData:      dict

# ── Helpers ──────────────────────────────────────────────────────────────────

def _fitness_factor(hiker: dict) -> float:
    level = hiker.get("fitnessLevel", "medium")
    return FITNESS_FACTORS.get(level, 1.0)


def _condition_factor(conditions: dict) -> float:
    surface = conditions.get("surfaceState", "dry")
    base    = SURFACE_FACTORS.get(surface, 1.0)
    hazards = conditions.get("activeHazards", 0)
    # Each active hazard adds ~3% time overhead
    hazard_penalty = 1.0 + (hazards * 0.03)
    return base * hazard_penalty


def _weather_factor(weather: dict) -> float:
    severity = weather.get("severity", "clear")
    mapping  = {
        "clear":   1.00,
        "cloudy":  1.02,
        "drizzle": 1.10,
        "rain":    1.20,
        "storm":   1.40,
        "extreme": 1.60,
    }
    return mapping.get(severity, 1.0)


def _parse_start_time(time_str: str) -> datetime:
    today = datetime.utcnow().date()
    return datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/estimate", tags=["Completion"])
async def estimate_completion(req: CompletionRequest):
    records = HISTORICAL_RECORDS.get(req.trailId)
    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"No historical records found for trail '{req.trailId}'."
        )

    # Compute base from historical median
    base_minutes  = median(records)
    fit_factor    = _fitness_factor(req.hikerProfile)
    cond_factor   = _condition_factor(req.trailConditions)
    wx_factor     = _weather_factor(req.weatherData)

    adjusted_mins = base_minutes * fit_factor * cond_factor * wx_factor
    adjusted_mins = round(adjusted_mins)

    # Start / return times
    start_dt      = _parse_start_time(req.plannedStartTime)
    est_return_dt = start_dt + timedelta(minutes=adjusted_mins)

    # Approximate sunset as 18:30 local (simplified – use a sun-position lib in production)
    sunset_dt     = start_dt.replace(hour=18, minute=30, second=0)
    returns_before_sunset = est_return_dt <= sunset_dt

    return {
        "trailId":              req.trailId,
        "historicalMedianMins": int(base_minutes),
        "sampleSize":           len(records),
        "fitnessFactor":        fit_factor,
        "conditionFactor":      round(cond_factor, 3),
        "weatherFactor":        wx_factor,
        "estimatedDurationMins":adjusted_mins,
        "estimatedDurationHuman":f"{adjusted_mins // 60}h {adjusted_mins % 60}m",
        "plannedStartTime":     req.plannedStartTime,
        "estimatedReturnTime":  est_return_dt.strftime("%H:%M"),
        "returnsBeforeSunset":  returns_before_sunset,
        "sunsetApprox":         "18:30",
    }


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Hike_Completion_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Hike_Completion_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8004)), reload=True)
