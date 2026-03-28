"""
TRAILGUARD – Hiker Profile Service  (Atomic)
Port: 8001

Swagger-aligned endpoints:
  POST /AddUser              — create a new hiker profile
  PUT  /Update/{userId}      — update an existing profile
  GET  /Capability/{userId}  — read fitness/experience/pace (Scenario 1)
  GET  /Credibility/{userId} — read experience/hike count (legacy)
  GET  /GetAll               — list all users
  GET  /hiker/{userId}       — internal full-record endpoint (kept for Scenario 2)

experienceRating derivation rule (Capability endpoint):
  0–4  hikes  → "beginner"
  5–14 hikes  → "intermediate"
  15+  hikes  → "advanced"

totalHikesCompleted is accepted by AddUser/Update as an optional field even
though the Swagger formal spec omits it. It is stored in the DB and drives
the derived experienceRating returned by Capability.
"""

import os
import uuid as _uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="TRAILGUARD – Hiker Profile Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Mock data store ──────────────────────────────────────────────────────────
HIKER_DB: dict[str, dict] = {
    "usr_001": {
        "userId":          "usr_001",
        "name":            "Alex Rivera",
        "fitnessLevel":    "high",
        "experienceTier":  "intermediate",
        "completedHikes":  42,
        "avgPaceMinPerKm": 14,
        "age":             28,
        "bio":             "Weekend hiker, loves jungle trails.",
        "medicalFlags":    [],
        "emergencyContact":"+1-555-0199",
    },
    "usr_002": {
        "userId":          "usr_002",
        "name":            "Sam Chen",
        "fitnessLevel":    "low",
        "experienceTier":  "beginner",
        "completedHikes":  3,
        "avgPaceMinPerKm": 22,
        "age":             22,
        "bio":             "New to hiking.",
        "medicalFlags":    ["asthma"],
        "emergencyContact":"",
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _derive_experience_rating(completed_hikes: int) -> str:
    """Derive experience tier from completed hike count."""
    if completed_hikes >= 15:
        return "advanced"
    if completed_hikes >= 5:
        return "intermediate"
    return "beginner"


# ── Swagger-aligned request schemas ──────────────────────────────────────────

class AddUserRequest(BaseModel):
    name:                str
    fitnessLevel:        str            # low | medium | high
    experienceRating:    Optional[str] = None   # beginner|intermediate|advanced (ignored — derived from hikes)
    age:                 Optional[int] = None
    bio:                 Optional[str] = ""
    # totalHikesCompleted is NOT in the formal Swagger spec for AddUser,
    # but we accept it here so the profile page can seed the hike counter.
    totalHikesCompleted: Optional[int] = 0
    # userId may be supplied by the orchestrator (mirrored from OutSystems)
    # so both systems share the same canonical ID.
    userId:              Optional[str] = None


class UpdateUserRequest(BaseModel):
    name:                Optional[str] = None
    fitnessLevel:        Optional[str] = None
    experienceRating:    Optional[str] = None   # accepted but overridden by derivation
    age:                 Optional[int] = None
    bio:                 Optional[str] = None
    totalHikesCompleted: Optional[int] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

# ── Swagger-aligned: POST /AddUser ───────────────────────────────────────────
@app.post("/AddUser", tags=["HikerProfileAPI"])
async def add_user(body: AddUserRequest):
    user_id = body.userId or f"usr_{_uuid.uuid4().hex[:8]}"
    hikes   = body.totalHikesCompleted or 0
    HIKER_DB[user_id] = {
        "userId":          user_id,
        "name":            body.name,
        "fitnessLevel":    body.fitnessLevel,
        "experienceTier":  _derive_experience_rating(hikes),
        "completedHikes":  hikes,
        "avgPaceMinPerKm": 15,          # default pace
        "age":             body.age,
        "bio":             body.bio or "",
        "medicalFlags":    [],
        "emergencyContact":"",
    }
    return {
        "userId":       user_id,
        "Success":      True,
        "ErrorCode":    0,
        "ErrorMessage": "",
    }


# ── Swagger-aligned: PUT /Update/{userId} ────────────────────────────────────
@app.put("/Update/{user_id}", tags=["HikerProfileAPI"])
async def update_user(user_id: str, body: UpdateUserRequest):
    if user_id not in HIKER_DB:
        return {"Success": False, "ErrorCode": 404,
                "ErrorMessage": f"User '{user_id}' not found."}
    rec = HIKER_DB[user_id]
    if body.name is not None:                rec["name"]        = body.name
    if body.fitnessLevel is not None:        rec["fitnessLevel"]= body.fitnessLevel
    if body.age is not None:                 rec["age"]         = body.age
    if body.bio is not None:                 rec["bio"]         = body.bio
    if body.totalHikesCompleted is not None:
        rec["completedHikes"]  = body.totalHikesCompleted
        rec["experienceTier"]  = _derive_experience_rating(body.totalHikesCompleted)
    return {"Success": True, "ErrorCode": 0, "ErrorMessage": ""}


# ── Swagger-aligned: GET /Capability/{userId} ────────────────────────────────
@app.get("/Capability/{user_id}", tags=["HikerProfileAPI"])
async def get_capability(user_id: str):
    profile = HIKER_DB.get(user_id)
    if not profile:
        return {
            "fitnessLevel":       None,
            "experienceRating":   None,
            "totalHikesCompleted":None,
            "typicalPace":        None,
            "Success":            False,
            "ErrorCode":          404,
            "ErrorMessage":       f"Hiker '{user_id}' not found.",
        }
    hikes = profile.get("completedHikes", 0)
    return {
        "fitnessLevel":        profile["fitnessLevel"],
        # experienceRating is DERIVED from completedHikes (not the stored string)
        "experienceRating":    _derive_experience_rating(hikes),
        "totalHikesCompleted": hikes,
        "typicalPace":         profile.get("avgPaceMinPerKm"),
        "Success":             True,
        "ErrorCode":           0,
        "ErrorMessage":        "",
    }


# ── Swagger-aligned: GET /Credibility/{userId} ───────────────────────────────
@app.get("/Credibility/{user_id}", tags=["HikerProfileAPI"])
async def get_credibility(user_id: str):
    profile = HIKER_DB.get(user_id)
    if not profile:
        return {"experienceRating": None, "totalHikesCompleted": None,
                "Success": False, "ErrorCode": 404}
    hikes = profile.get("completedHikes", 0)
    return {
        "experienceRating":    _derive_experience_rating(hikes),
        "totalHikesCompleted": hikes,
        "Success":             True,
        "ErrorCode":           0,
    }


# ── Swagger-aligned: GET /GetAll ─────────────────────────────────────────────
@app.get("/GetAll", tags=["HikerProfileAPI"])
async def get_all():
    return list(HIKER_DB.values())


# ── Internal: GET /hiker/{userId} (kept for Scenario 2 emergency contact) ────
@app.get("/hiker/{user_id}", tags=["Internal"])
async def get_hiker_profile(user_id: str):
    profile = HIKER_DB.get(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Hiker '{user_id}' not found.")
    return profile


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Hiker_Profile_Service", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Hiker_Profile_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8001)), reload=True)
