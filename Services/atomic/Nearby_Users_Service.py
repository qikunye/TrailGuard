"""
TRAILGUARD – Nearby Users Service  (Atomic)
Port: 5005

Thin proxy around the OutSystems CompletedUserHikeAPI.
Returns all users currently hiking on a given trail (isHiking = True / completed = False).

Endpoints:
  GET  /getNearby/{trail_id}   → proxies to OutSystems getNearby
  GET  /health                 → liveness check
"""

import os
import logging
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("NearbyUsersService")

app = FastAPI(title="TRAILGUARD – Nearby Users Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────────────────

NEARBY_USERS_API_URL = os.getenv(
    "NEARBY_USERS_API_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/HikeProgressAPI",
)

TIMEOUT = 10.0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/getNearby/{trail_id}", tags=["NearbyUsers"])
async def get_nearby(trail_id: int):
    """
    Return user IDs of all hikers currently on the given trail (isHiking = True).
    Proxies to OutSystems HikeProgressAPI/GetNearby/{trail_id}.

    Response shape (from OutSystems):
      {
        "nearbyUserIds": [1, 2, 3],
        "nearbyUserCount": 3,
        "Success": true,
        "ErrorCode": ""
      }
    """
    url = f"{NEARBY_USERS_API_URL}/GetNearby/{trail_id}"
    log.info("Proxying GET %s", url)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=TIMEOUT)
        except httpx.RequestError as e:
            log.error("Cannot reach OutSystems: %s", e)
            raise HTTPException(status_code=503, detail="OutSystems HikeProgressAPI unreachable")
    if not resp.is_success:
        log.error("OutSystems returned %s: %s", resp.status_code, resp.text)
        raise HTTPException(status_code=resp.status_code, detail="Upstream error from OutSystems")
    return resp.json()


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Nearby_Users_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Nearby_Users_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 5005)), reload=True)
