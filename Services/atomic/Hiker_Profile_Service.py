"""
TRAILGUARD – Hiker Profile Service  (Atomic)
Port: 8001

Returns fitness level, experience tier, and medical flags for a given userId.
In production this would query a database; here we use mock data.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TRAILGUARD – Hiker Profile Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Mock data store ──────────────────────────────────────────────────────────
HIKER_DB: dict[str, dict] = {
    "usr_001": {
        "userId":          "usr_001",
        "name":            "Alex Rivera",
        "fitnessLevel":    "high",         # low | medium | high
        "experienceTier":  "intermediate", # beginner | intermediate | advanced | expert
        "completedHikes":  42,
        "avgPaceMinPerKm": 14,
        "medicalFlags":    [],             # e.g. ["asthma", "knee_injury"]
        "emergencyContact":"+1-555-0199",
    },
    "usr_002": {
        "userId":          "usr_002",
        "name":            "Sam Chen",
        "fitnessLevel":    "low",
        "experienceTier":  "beginner",
        "completedHikes":  3,
        "avgPaceMinPerKm": 22,
        "medicalFlags":    ["asthma"],
        "emergencyContact":"",
    },
}

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/hiker/{user_id}", tags=["Hiker"])
async def get_hiker_profile(user_id: str):
    profile = HIKER_DB.get(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Hiker '{user_id}' not found.")
    return profile


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Hiker_Profile_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Hiker_Profile_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8001)), reload=True)
