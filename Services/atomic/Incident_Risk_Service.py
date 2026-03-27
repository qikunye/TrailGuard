"""
TRAILGUARD – Incident Risk Service  (Atomic)
Port: 8003

Returns recent injury/incident statistics for a given trail.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TRAILGUARD – Incident Risk Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Mock incident data ───────────────────────────────────────────────────────
RISK_DB: dict[str, dict] = {
    "1":  {"trailId": "1",  "incidentsLast30Days": 1, "incidentsLast90Days": 4,
           "riskScore": 18, "riskTier": "low",    "mostCommonIncidentType": "sprained_ankle"},
    "2":  {"trailId": "2",  "incidentsLast30Days": 2, "incidentsLast90Days": 6,
           "riskScore": 28, "riskTier": "low",    "mostCommonIncidentType": "dehydration"},
    "3":  {"trailId": "3",  "incidentsLast30Days": 4, "incidentsLast90Days": 11,
           "riskScore": 52, "riskTier": "medium", "mostCommonIncidentType": "slip_and_fall"},
    "4":  {"trailId": "4",  "incidentsLast30Days": 0, "incidentsLast90Days": 2,
           "riskScore": 12, "riskTier": "low",    "mostCommonIncidentType": "dehydration"},
    "5":  {"trailId": "5",  "incidentsLast30Days": 0, "incidentsLast90Days": 1,
           "riskScore": 10, "riskTier": "low",    "mostCommonIncidentType": "insect_sting"},
    "6":  {"trailId": "6",  "incidentsLast30Days": 1, "incidentsLast90Days": 3,
           "riskScore": 15, "riskTier": "low",    "mostCommonIncidentType": "sprained_ankle"},
    "7":  {"trailId": "7",  "incidentsLast30Days": 0, "incidentsLast90Days": 2,
           "riskScore": 14, "riskTier": "low",    "mostCommonIncidentType": "dehydration"},
    "8":  {"trailId": "8",  "incidentsLast30Days": 2, "incidentsLast90Days": 5,
           "riskScore": 30, "riskTier": "low",    "mostCommonIncidentType": "sprained_ankle"},
    "9":  {"trailId": "9",  "incidentsLast30Days": 2, "incidentsLast90Days": 6,
           "riskScore": 35, "riskTier": "medium", "mostCommonIncidentType": "slip_and_fall"},
    "10": {"trailId": "10", "incidentsLast30Days": 1, "incidentsLast90Days": 4,
           "riskScore": 22, "riskTier": "low",    "mostCommonIncidentType": "dehydration"},
}

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/risk/{trail_id}", tags=["Risk"])
async def get_incident_risk(trail_id: str):
    data = RISK_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Risk data for trail '{trail_id}' not found.")
    return data


# ── Swagger-aligned endpoint: IncidentsAPI / GetRecentIncidents ───────────────
# Mirrors: GET /HikerProfileService/rest/IncidentsAPI/GetRecentIncidents/{trailId}/{recentDays}
# Returns only the fields the Swagger contract guarantees.
@app.get("/GetRecentIncidents/{trail_id}/{recent_days}", tags=["IncidentsAPI"])
async def get_recent_incidents(trail_id: str, recent_days: int):
    data = RISK_DB.get(trail_id)
    if not data:
        return {"Success": False, "incidentCount": 0, "ErrorCode": 404}
    # Map recentDays to the closest available historical window.
    # The Swagger only returns incidentCount — no richer metrics.
    if recent_days <= 30:
        count = data["incidentsLast30Days"]
    else:
        count = data["incidentsLast90Days"]
    return {
        "Success":       True,
        "incidentCount": count,
        "ErrorCode":     0,
    }


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Risk_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Risk_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8003)), reload=True)
