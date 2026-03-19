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
    "trail_mt_kinabalu": {
        "trailId":                  "trail_mt_kinabalu",
        "incidentsLast30Days":      7,
        "incidentsLast90Days":      18,
        "injuriesLast30Days":       3,
        "fatalitiesAllTime":        2,
        "mostCommonIncidentType":   "slip_and_fall",
        "riskScore":                72,          # 0–100; higher = riskier
        "riskTier":                 "high",      # low | medium | high | critical
        "lastIncidentDate":         "2025-08-09",
        "searchAndRescueCallouts":  2,
        "notes":                    "Increased incidents during wet season (July–September).",
    },
    "trail_jungle_loop": {
        "trailId":                  "trail_jungle_loop",
        "incidentsLast30Days":      1,
        "incidentsLast90Days":      3,
        "injuriesLast30Days":       0,
        "fatalitiesAllTime":        0,
        "mostCommonIncidentType":   "dehydration",
        "riskScore":                22,
        "riskTier":                 "low",
        "lastIncidentDate":         "2025-07-28",
        "searchAndRescueCallouts":  0,
        "notes":                    "Generally safe; carry sufficient water.",
    },
}

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/risk/{trail_id}", tags=["Risk"])
async def get_incident_risk(trail_id: str):
    data = RISK_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Risk data for trail '{trail_id}' not found.")
    return data


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Incident_Risk_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Incident_Risk_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8003)), reload=True)
