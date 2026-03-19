"""
TRAILGUARD – Trail Condition Service  (Atomic)
Port: 8002

Returns difficulty rating, surface state, active hazard count, and closure flags.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TRAILGUARD – Trail Condition Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Mock data store ──────────────────────────────────────────────────────────
TRAIL_DB: dict[str, dict] = {
    "trail_mt_kinabalu": {
        "trailId":          "trail_mt_kinabalu",
        "name":             "Mount Kinabalu Summit Trail",
        "distanceKm":       8.7,
        "elevationGainM":   2200,
        "difficultyRating": 4,        # 1 (easy) – 5 (extreme)
        "surfaceState":     "wet",    # dry | damp | wet | icy
        "activeHazards":    2,        # count of current hazard reports
        "hazardDetails": [
            {"type": "slippery_rocks", "severity": "moderate", "location": "km 4.2"},
            {"type": "fallen_tree",    "severity": "minor",    "location": "km 1.8"},
        ],
        "isClosed":         False,
        "lastInspected":    "2025-08-10T08:00:00Z",
    },
    "trail_jungle_loop": {
        "trailId":          "trail_jungle_loop",
        "name":             "Jungle Loop Trail",
        "distanceKm":       5.0,
        "elevationGainM":   150,
        "difficultyRating": 2,
        "surfaceState":     "damp",
        "activeHazards":    0,
        "hazardDetails":    [],
        "isClosed":         False,
        "lastInspected":    "2025-08-12T09:00:00Z",
    },
}

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/trail/{trail_id}/conditions", tags=["Trail"])
async def get_trail_conditions(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Trail '{trail_id}' not found.")
    return data


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Condition_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Condition_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8002)), reload=True)
