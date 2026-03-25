"""
TRAILGUARD – Emergency Contacts Service  (Atomic)
Port: 5003

Thin proxy around the OutSystems EmergencyContactsAPI.
No business logic — all data lives in OutSystems.

Endpoints:
  GET  /GetEmergency/{user_id}  → proxies to OutSystems GetEmergency
  POST /AddEmergency            → proxies to OutSystems AddEmergency
  GET  /health                  → liveness check
"""

import os
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="TRAILGUARD – Emergency Contacts Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────────────────

OUTSYSTEMS_BASE_URL = os.getenv(
    "OUTSYSTEMS_BASE_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/EmergencyContactsAPI",
)

TIMEOUT = 10.0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/GetEmergency/{user_id}", tags=["Emergency"])
async def get_emergency(user_id: int):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{OUTSYSTEMS_BASE_URL}/GetEmergency/{user_id}", timeout=TIMEOUT)
    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")
    return resp.json()


@app.post("/AddEmergency", tags=["Emergency"])
async def add_emergency(request: Request):
    body = await request.json()
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{OUTSYSTEMS_BASE_URL}/AddEmergency", json=body, timeout=TIMEOUT)
    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")
    return resp.json()


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Emergency_Contacts_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Emergency_Contacts_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 5003)), reload=True)
