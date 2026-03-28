"""
TRAILGUARD – Completed User Hike Service  (Atomic)
Port: 5006

Thin proxy to the OutSystems HikeProgressAPI.

Endpoints (OutSystems):
  POST /AddHike               → create hike record, set isHiking=True
  PUT  /UpdateHike/{hikeId}   → mark hike complete, set isHiking=False
  GET  /GetNearby/{trailId}   → already covered by Nearby_Users_Service

Our endpoints:
  POST /hikes/start            → proxy to AddHike
  PUT  /hikes/{hike_id}/end   → proxy to UpdateHike/{hikeId}
  GET  /health
"""

import os
import logging
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("CompletedUserHikeService")

HIKE_API_URL = os.getenv(
    "HIKE_PROGRESS_API_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/HikeProgressAPI",
)

TIMEOUT = httpx.Timeout(15.0, connect=5.0)

app = FastAPI(title="TRAILGUARD – Completed User Hike Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class StartHikeRequest(BaseModel):
    hikerProfileId: int   = Field(..., example=1)
    trailId:        int   = Field(..., example=1)
    startDate:      str   = Field(..., example="2026-03-28")   # YYYY-MM-DD
    startTime:      str   = Field(..., example="08:30:00")     # HH:MM:SS


class EndHikeRequest(BaseModel):
    hikerProfileId: int   = Field(..., example=1)
    trailId:        int   = Field(..., example=1)
    startDate:      str   = Field(..., example="2026-03-28")
    startTime:      str   = Field(..., example="08:30:00")
    endTime:        str   = Field(..., example="10:45:00")     # HH:MM:SS
    distance:       float = Field(..., example=5.2)            # km


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/hikes/start", tags=["Hikes"])
async def start_hike(body: StartHikeRequest):
    """
    POST /AddHike — creates a hike record with isHiking=True.
    User will now appear in GetNearby results for their trail.
    """
    payload = {
        "HikerProfileId": body.hikerProfileId,
        "trailId":        body.trailId,
        "startDate":      body.startDate,
        "startTime":      body.startTime,
        "isHiking":       True,
    }
    log.info("AddHike | userId=%s trailId=%s", body.hikerProfileId, body.trailId)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{HIKE_API_URL}/AddHike", json=payload, timeout=TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            log.info("AddHike response: %s", data)
            return data
        except httpx.HTTPStatusError as e:
            log.error("AddHike HTTP error: %s", e)
            raise HTTPException(status_code=502, detail=str(e))
        except httpx.RequestError as e:
            log.error("AddHike connection error: %s", e)
            raise HTTPException(status_code=503, detail=f"Cannot reach OutSystems: {e}")


@app.put("/hikes/{hike_id}/end", tags=["Hikes"])
async def end_hike(hike_id: int, body: EndHikeRequest):
    """
    PUT /UpdateHike/{hikeId} — marks the hike as completed with isHiking=False.
    OutSystems requires the full original record fields plus endTime and distance.
    """
    payload = {
        "HikerProfileId": body.hikerProfileId,
        "trailId":        body.trailId,
        "startDate":      body.startDate,
        "startTime":      body.startTime,
        "endTime":        body.endTime,
        "distance":       round(body.distance, 3),
        "isHiking":       False,
    }
    log.info("UpdateHike | hikeId=%s payload=%s", hike_id, payload)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.put(
                f"{HIKE_API_URL}/UpdateHike/{hike_id}",
                json=payload,
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            log.info("UpdateHike response: %s", data)
            return data
        except httpx.HTTPStatusError as e:
            log.error("UpdateHike HTTP error: %s", e)
            raise HTTPException(status_code=502, detail=str(e))
        except httpx.RequestError as e:
            log.error("UpdateHike connection error: %s", e)
            raise HTTPException(status_code=503, detail=f"Cannot reach OutSystems: {e}")


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Completed_User_Hike_Service", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Completed_User_Hike_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 5006)), reload=True)
