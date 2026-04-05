"""
TRAILGUARD – Hiker Profile Service  (Atomic)
Port: 8001

Pure proxy to the OutSystems HikerProfileAPI.
No local data — all reads and writes go directly to OutSystems.

OutSystems base URL:
  https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/HikerProfileAPI

Endpoints:
  POST /AddUser              → OutSystems AddUser
  PUT  /Update/{userId}      → OutSystems Update/{userId}
  GET  /Capability/{userId}  → OutSystems Capability/{userId}
  GET  /Credibility/{userId} → OutSystems Credibility/{userId}
  GET  /GetAll               → OutSystems GetAll
  GET  /hiker/{userId}       → OutSystems Capability/{userId} (internal alias)
  GET  /health
"""

import os
import logging
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("HikerProfileService")

OUTSYSTEMS_URL = os.getenv(
    "OUTSYSTEMS_HIKER_PROFILE_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/HikerProfileAPI",
)

TIMEOUT = httpx.Timeout(10.0, connect=5.0)

app = FastAPI(title="TRAILGUARD – Hiker Profile Service", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            log.error("OutSystems HTTP error %s: %s", url, e)
            raise HTTPException(status_code=e.response.status_code, detail="OutSystems error")
        except httpx.RequestError as e:
            log.error("OutSystems unreachable %s: %s", url, e)
            raise HTTPException(status_code=503, detail="OutSystems HikerProfileAPI unreachable")


async def _post(url: str, body: dict) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=body, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            log.error("OutSystems HTTP error %s: %s", url, e)
            raise HTTPException(status_code=e.response.status_code, detail="OutSystems error")
        except httpx.RequestError as e:
            log.error("OutSystems unreachable %s: %s", url, e)
            raise HTTPException(status_code=503, detail="OutSystems HikerProfileAPI unreachable")


async def _put(url: str, body: dict) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.put(url, json=body, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            log.error("OutSystems HTTP error %s: %s", url, e)
            raise HTTPException(status_code=e.response.status_code, detail="OutSystems error")
        except httpx.RequestError as e:
            log.error("OutSystems unreachable %s: %s", url, e)
            raise HTTPException(status_code=503, detail="OutSystems HikerProfileAPI unreachable")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/AddUser", tags=["HikerProfileAPI"])
async def add_user(request: Request):
    body = await request.json()
    log.info("AddUser → OutSystems")
    return await _post(f"{OUTSYSTEMS_URL}/AddUser", body)


@app.put("/Update/{user_id}", tags=["HikerProfileAPI"])
async def update_user(user_id: str, request: Request):
    body = await request.json()
    log.info("Update/%s → OutSystems", user_id)
    return await _put(f"{OUTSYSTEMS_URL}/Update/{user_id}", body)


@app.get("/Capability/{user_id}", tags=["HikerProfileAPI"])
async def get_capability(user_id: str):
    log.info("Capability/%s → OutSystems", user_id)
    return await _get(f"{OUTSYSTEMS_URL}/Capability/{user_id}")


@app.get("/Credibility/{user_id}", tags=["HikerProfileAPI"])
async def get_credibility(user_id: str):
    log.info("Credibility/%s → OutSystems", user_id)
    return await _get(f"{OUTSYSTEMS_URL}/Credibility/{user_id}")


@app.get("/GetAll", tags=["HikerProfileAPI"])
async def get_all():
    log.info("GetAll → OutSystems")
    return await _get(f"{OUTSYSTEMS_URL}/GetAll")


@app.get("/hiker/{user_id}", tags=["Internal"])
async def get_hiker_profile(user_id: str):
    """Internal alias used by Scenario 2 — returns Capability data."""
    log.info("hiker/%s → OutSystems Capability", user_id)
    return await _get(f"{OUTSYSTEMS_URL}/Capability/{user_id}")


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Hiker_Profile_Service", "version": "3.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Hiker_Profile_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8001)), reload=True)
