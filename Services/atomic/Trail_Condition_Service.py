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

# ── Trail data (matches real TrailDBAPI schema) ───────────────────────────────
# trailId       : integer ID from the real API (stored as string key)
# difficulty    : "Easy" | "Moderate" | "Hard"  (string, from real API)
# operationalStatus: "OPEN" | "CLOSED" | "CAUTION"  (uppercase, from real API)
# startPoint / endPoint: "lat, lng"  coordinate strings (from real API)
TRAIL_DB: dict[str, dict] = {
    # startPoint / endPoint: road-accessible trailhead / carpark entrances
    # so that Google Maps Directions can route to/from them.
    "1": {
        "trailId": "1", "name": "Southern Ridges Loop",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        # HarbourFront MRT → Hort Park main gate (Alexandra Road)
        "startPoint": "1.2644, 103.8208", "endPoint": "1.2895, 103.8043",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "2": {
        "trailId": "2", "name": "MacRitchie Reservoir Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        # MacRitchie Reservoir carpark (Island Club Rd) → Venus Drive carpark
        "startPoint": "1.3442, 103.8197", "endPoint": "1.3592, 103.8320",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "3": {
        "trailId": "3", "name": "Bukit Timah Summit Trail",
        "difficulty": "Hard", "difficultyRating": 4,
        "operationalStatus": "OPEN",
        # Bukit Timah Nature Reserve main entrance (Hindhede Dr) → Dairy Farm Nature Park entrance
        "startPoint": "1.3511, 103.7761", "endPoint": "1.3468, 103.7738",
        "activeHazards": 1,
        "hazardDetails": [{"type": "slippery_rocks", "severity": "minor", "location": "upper slope"}],
        "isClosed": False,
    },
    "4": {
        "trailId": "4", "name": "Labrador Nature Reserve Trail",
        "difficulty": "Easy", "difficultyRating": 1,
        "operationalStatus": "OPEN",
        # Labrador Park MRT exit → Berlayer Creek lookout area
        "startPoint": "1.2627, 103.8030", "endPoint": "1.2706, 103.8083",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "5": {
        "trailId": "5", "name": "Sungei Buloh Wetland Walk",
        "difficulty": "Easy", "difficultyRating": 1,
        "operationalStatus": "OPEN",
        # Sungei Buloh main entrance (Neo Tiew Crescent) → far observation hide
        "startPoint": "1.4467, 103.7240", "endPoint": "1.4514, 103.7304",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "6": {
        "trailId": "6", "name": "Bukit Batok Nature Park Loop",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        # Bukit Batok NP entrance (Bukit Batok East Ave 2) → Little Guilin viewpoint
        "startPoint": "1.3479, 103.7601", "endPoint": "1.3504, 103.7635",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "7": {
        "trailId": "7", "name": "Pulau Ubin Chek Jawa Trail",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "OPEN",
        # Pulau Ubin village (near jetty) → Chek Jawa Wetlands visitor centre
        "startPoint": "1.4044, 103.9592", "endPoint": "1.4002, 103.9671",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "8": {
        "trailId": "8", "name": "Kent Ridge Park Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        # Kent Ridge Park entrance (Vigilante Drive) → West Coast Road end
        "startPoint": "1.2960, 103.7836", "endPoint": "1.2875, 103.7880",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
    "9": {
        "trailId": "9", "name": "Admiralty Park Mangrove Trail",
        "difficulty": "Easy", "difficultyRating": 2,
        "operationalStatus": "CAUTION",
        # Admiralty Park main entrance (Admiralty Road West) → mangrove boardwalk far end
        "startPoint": "1.4406, 103.7990", "endPoint": "1.4451, 103.8032",
        "activeHazards": 1,
        "hazardDetails": [{"type": "slippery_boardwalk", "severity": "moderate", "location": "mangrove section"}],
        "isClosed": False,
    },
    "10": {
        "trailId": "10", "name": "Clementi Forest Trail",
        "difficulty": "Moderate", "difficultyRating": 3,
        "operationalStatus": "OPEN",
        # Clementi Ave 6 forest access → West Coast Highway end
        "startPoint": "1.3243, 103.7682", "endPoint": "1.3299, 103.7748",
        "activeHazards": 0, "hazardDetails": [], "isClosed": False,
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _highest_severity(hazard_details: list) -> str:
    rank = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "critical": 4}
    if not hazard_details:
        return "none"
    return max(hazard_details, key=lambda h: rank.get(h.get("severity", "minor"), 1))["severity"]


def _is_closed(data: dict) -> bool:
    return data.get("isClosed", False) or data.get("operationalStatus") == "CLOSED"


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/trail/{trail_id}/conditions", tags=["Trail"])
async def get_trail_conditions(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Trail '{trail_id}' not found.")
    return data


@app.get("/GetAllTrails", tags=["TrailDBAPI"])
async def get_all_trails():
    trails = [
        {
            "trailId":           data["trailId"],
            "trailName":         data["name"],
            "difficulty":        data["difficulty"],
            "operationalStatus": data["operationalStatus"],
            "startPoint":        data["startPoint"],
            "endPoint":          data["endPoint"],
        }
        for data in TRAIL_DB.values()
    ]
    return {"trails": trails, "totalCount": len(trails), "Success": True, "ErrorCode": 0}


# ── Swagger-aligned endpoint: TrailConditionAPI / Condition ──────────────────
# Mirrors: GET /HikerProfileService/rest/TrailConditionAPI/Condition/{trailId}
# Returns only the fields the Swagger contract guarantees.
@app.get("/Condition/{trail_id}", tags=["TrailConditionAPI"])
async def get_condition(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        return {
            "operationalStatus": None, "activeHazardCounts": None,
            "highestSeverity": None, "hazardTypes": None,
            "Success": False, "ErrorCode": 404,
            "ErrorMessage": f"Trail '{trail_id}' not found.",
        }
    closed = _is_closed(data)
    return {
        "operationalStatus":  "closed" if closed else data["operationalStatus"].lower(),
        "activeHazardCounts": data["activeHazards"],
        "highestSeverity":    _highest_severity(data.get("hazardDetails", [])),
        "hazardTypes":        list({h["type"] for h in data.get("hazardDetails", [])}),
        "Success": True, "ErrorCode": 0, "ErrorMessage": "",
    }


@app.get("/GetTrail/{trail_id}", tags=["TrailDBAPI"])
async def get_trail(trail_id: str):
    data = TRAIL_DB.get(trail_id)
    if not data:
        return {"trailId": trail_id, "trailName": None, "difficulty": None,
                "operationalStatus": None, "Success": False, "ErrorCode": 404}
    closed = _is_closed(data)
    return {
        "trailId":           data["trailId"],
        "trailName":         data["name"],
        "difficulty":        data["difficultyRating"],   # integer (1-5) for downstream use
        "difficultyLabel":   data["difficulty"],          # "Easy"/"Moderate"/"Hard" for display
        "operationalStatus": "closed" if closed else data["operationalStatus"].lower(),
        "Success": True, "ErrorCode": 0,
    }


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Condition_Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Trail_Condition_Service:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8002)), reload=True)
