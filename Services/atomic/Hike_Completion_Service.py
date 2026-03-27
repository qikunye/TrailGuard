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
    # Easy (~9 km, flat): ~120–180 min round-trip
    "1": [130, 145, 120, 160, 138, 152, 125, 170, 135, 148,
          142, 155, 128, 165, 140, 132, 158, 122, 168, 144],
    # Moderate (~11 km, varied): ~150–240 min
    "2": [170, 190, 155, 210, 175, 200, 162, 220, 178, 185,
          195, 215, 160, 205, 188, 173, 225, 158, 212, 182],
    # Hard (steep summit, short but intense): ~90–150 min
    "3": [100, 115, 90, 130, 105, 120, 95, 140, 108, 112,
          118, 135, 88, 125, 110, 102, 145, 92, 132, 107],
    # Easy (~4 km, coastal flat): ~60–90 min
    "4": [68, 75, 62, 85, 70, 78, 65, 88, 72, 74,
          79, 82, 60, 86, 71, 66, 90, 63, 84, 73],
    # Easy (~5 km, flat wetland boardwalk): ~80–110 min
    "5": [85, 95, 78, 105, 88, 98, 82, 108, 90, 93,
          97, 103, 76, 107, 89, 83, 110, 80, 104, 92],
    # Easy (~4 km loop): ~60–90 min
    "6": [65, 72, 60, 82, 68, 76, 62, 85, 70, 73,
          77, 80, 58, 84, 69, 63, 88, 61, 83, 71],
    # Easy (~5 km, flat): ~80–110 min
    "7": [88, 98, 80, 108, 92, 102, 84, 112, 94, 96,
          100, 106, 78, 110, 91, 86, 115, 82, 107, 95],
    # Moderate (~5 km, hilly): ~90–150 min
    "8": [105, 120, 95, 138, 110, 125, 98, 145, 112, 118,
          122, 135, 92, 142, 115, 107, 148, 94, 140, 119],
    # Easy (~4 km, mangrove boardwalk): ~60–90 min
    "9": [70, 78, 64, 88, 73, 80, 67, 90, 75, 77,
          81, 85, 62, 87, 74, 68, 92, 65, 86, 76],
    # Moderate (~5 km, secondary forest): ~90–140 min
    "10": [100, 115, 88, 132, 105, 120, 92, 138, 108, 112,
           118, 128, 85, 135, 110, 102, 142, 90, 130, 115],
}

# ── Adjustment factors ───────────────────────────────────────────────────────
FITNESS_FACTORS: dict[str, float] = {
    "high":   0.85,
    "medium": 1.00,
    "low":    1.25,
}

# Replaces SURFACE_FACTORS: surface state is NOT in the Swagger contract.
# TrailConditionAPI/Condition returns highestSeverity, which we use instead.
SEVERITY_FACTORS: dict[str, float] = {
    "none":     1.00,
    "minor":    1.08,
    "moderate": 1.20,
    "severe":   1.40,
    "critical": 1.60,
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
    # Use Swagger-backed fields: highestSeverity (TrailConditionAPI) and
    # activeHazardCounts (TrailConditionAPI). surfaceState is not in Swagger.
    severity = conditions.get("highestSeverity", "none")
    base     = SEVERITY_FACTORS.get(severity, 1.0)
    hazards  = conditions.get("activeHazardCounts", 0)
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
