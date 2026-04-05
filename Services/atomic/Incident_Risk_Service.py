"""
TRAILGUARD – Incident Risk Service  (Atomic)
Port: 8003

Returns recent injury/incident statistics for a given trail.
All data comes directly from OutSystems IncidentsAPI — no local fallback.

OutSystems endpoint:
  GET /HikerProfileService/rest/IncidentsAPI/GetRecentIncidents/{trailId}/{recentDays}
  Response: { "Success": bool, "incidentCount": int, "ErrorCode": int }
"""

import os
import logging
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("IncidentRiskService")

app = FastAPI(title="TRAILGUARD – Incident Risk Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTSYSTEMS_INCIDENTS_URL = os.getenv(
    "OUTSYSTEMS_INCIDENTS_URL",
    "https://personal-eisumi2z.outsystemscloud.com/HikerProfileService/rest/IncidentsAPI",
)


def _risk_tier(count_30: int, count_90: int) -> tuple[int, str]:
    score = count_30 * 10 + count_90 * 2
    if score >= 50:
        tier = "high"
    elif score >= 25:
        tier = "medium"
    else:
        tier = "low"
    return score, tier


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/risk/{trail_id}", tags=["Risk"])
async def get_incident_risk(trail_id: str):
    """
    Returns aggregated risk data for the trail.
    Fetches 30-day and 90-day incident counts from OutSystems.
    Returns 503 if OutSystems is unavailable.
    """
    count_30: int | None = None
    count_90: int | None = None

    async with httpx.AsyncClient(timeout=5.0) as client:
        # ── Fetch 30-day count ────────────────────────────────────────────────
        try:
            r = await client.get(f"{OUTSYSTEMS_INCIDENTS_URL}/GetRecentIncidents/{trail_id}/30")
            if r.status_code == 200:
                data = r.json()
                if data.get("Success"):
                    count_30 = int(data.get("incidentCount", 0))
                    log.info("OutSystems IncidentsAPI/30d trailId=%s count=%s", trail_id, count_30)
                else:
                    log.warning("OutSystems IncidentsAPI/30d trailId=%s returned Success=False", trail_id)
            else:
                log.warning("OutSystems IncidentsAPI/30d trailId=%s status=%s", trail_id, r.status_code)
        except Exception as exc:
            log.error("OutSystems IncidentsAPI (30d) unreachable: %s", exc)
            raise HTTPException(status_code=503, detail="OutSystems IncidentsAPI unreachable")

        # ── Fetch 90-day count ────────────────────────────────────────────────
        try:
            r = await client.get(f"{OUTSYSTEMS_INCIDENTS_URL}/GetRecentIncidents/{trail_id}/90")
            if r.status_code == 200:
                data = r.json()
                if data.get("Success"):
                    count_90 = int(data.get("incidentCount", 0))
                    log.info("OutSystems IncidentsAPI/90d trailId=%s count=%s", trail_id, count_90)
                else:
                    count_90 = 0
            else:
                count_90 = 0
        except Exception as exc:
            log.warning("OutSystems IncidentsAPI (90d) unreachable: %s", exc)
            count_90 = 0

    if count_30 is None:
        raise HTTPException(status_code=503, detail="OutSystems IncidentsAPI unavailable")

    score, tier = _risk_tier(count_30, count_90)

    return {
        "trailId":             trail_id,
        "incidentsLast30Days": count_30,
        "incidentsLast90Days": count_90,
        "riskScore":           score,
        "riskTier":            tier,
        "source":              "outsystems",
    }


@app.get("/GetRecentIncidents/{trail_id}/{recent_days}", tags=["IncidentsAPI"])
async def get_recent_incidents(trail_id: str, recent_days: int):
    """
    Pure proxy to OutSystems IncidentsAPI/GetRecentIncidents.
    Returns 503 if OutSystems is unavailable.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(
                f"{OUTSYSTEMS_INCIDENTS_URL}/GetRecentIncidents/{trail_id}/{recent_days}"
            )
            r.raise_for_status()
            data = r.json()
            log.info("OutSystems IncidentsAPI trailId=%s days=%s → %s",
                     trail_id, recent_days, data.get("incidentCount"))
            return data
        except httpx.HTTPStatusError as e:
            log.error("OutSystems IncidentsAPI HTTP error: %s", e)
            raise HTTPException(status_code=e.response.status_code, detail="OutSystems error")
        except Exception as exc:
            log.error("OutSystems IncidentsAPI unreachable: %s", exc)
            raise HTTPException(status_code=503, detail="OutSystems IncidentsAPI unreachable")


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Risk_Service", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Risk_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8003)), reload=True)
