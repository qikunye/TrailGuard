"""
TRAILGUARD – Trail Query Service  (GraphQL, Atomic)
Port: 8011

GraphQL API that aggregates trail conditions, user-reported hazards, and
recent incidents into a single query — replacing three separate REST calls
on the Track Hike page with one GraphQL POST.

Schema:
  query {
    trailDashboard(trailId: String!) {
      trailId
      name
      operationalStatus
      difficulty
      activeHazards
      hazardDetails { type severity location }
      reportedHazards { hazardId hazardType severity description reportedAt }
      isClosed
      lastUpdated
      recentIncidents {
        incidentId
        injuryType
        severity
        description
        reportedAt
        location { lat lng }
      }
    }
  }

Endpoint: POST /graphql   (standard GraphQL over HTTP)
          GET  /graphql   (GraphiQL playground in browser)
          GET  /health
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import strawberry
from strawberry.fastapi import GraphQLRouter
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TrailQueryService")

# ── Upstream service URLs ─────────────────────────────────────────────────────
TRAIL_CONDITION_URL = os.getenv("TRAIL_CONDITION_URL", "http://trail-condition:8002")
TRAIL_INCIDENT_URL  = os.getenv("TRAIL_INCIDENT_URL",  "http://incident-service:5004")
GOOGLEMAPS_URL      = os.getenv("GOOGLEMAPS_URL",      "http://googlemaps-wrapper:8007")

TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# ── Reverse geocode cache  ────────────────────────────────────────────────────
# Keyed by "lat,lon" string — avoids repeated API calls for the same coordinates.
_geocode_cache: dict[str, str] = {}


# ── GraphQL types ─────────────────────────────────────────────────────────────

@strawberry.type
class HazardDetail:
    type:        str
    severity:    str
    location:    str
    description: Optional[str] = None
    reported_at: Optional[str] = None


@strawberry.type
class ReportedHazard:
    hazard_id:   str
    hazard_type: str
    severity:    int
    description: str
    reported_at: str


@strawberry.type
class IncidentLocation:
    lat: float
    lng: float


@strawberry.type
class RecentIncident:
    incident_id:  str
    injury_type:  str
    severity:     int
    description:  str
    reported_at:  str
    location:     Optional[IncidentLocation]


@strawberry.type
class TrailDashboard:
    trail_id:                    str
    name:                        str
    operational_status:          str
    difficulty:                  str
    active_hazards:              int
    hazard_details:              list[HazardDetail]
    reported_hazards:            list[ReportedHazard]
    is_closed:                   bool
    last_updated:                Optional[str]
    recent_incidents:            list[RecentIncident]
    distance_km:                 Optional[float]     = None
    estimated_duration_mins:     Optional[int]       = None
    recommended_pace_mins_per_km: Optional[int]      = None


# ── Fetchers ──────────────────────────────────────────────────────────────────

async def _fetch_trail_condition(client: httpx.AsyncClient, trail_id: str) -> dict:
    try:
        resp = await client.get(f"{TRAIL_CONDITION_URL}/trail/{trail_id}/conditions", timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.warning("Trail Condition Service unavailable for trailId=%s: %s", trail_id, e)
        return {}


async def _fetch_incidents(client: httpx.AsyncClient, trail_id: str) -> list[dict]:
    try:
        resp = await client.get(f"{TRAIL_INCIDENT_URL}/incidents/trail/{trail_id}", timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("incidents", [])
    except Exception as e:
        log.warning("Trail Incident Service unavailable for trailId=%s: %s", trail_id, e)
        return []


async def _fetch_reported_hazards(client: httpx.AsyncClient, trail_id: str) -> list[dict]:
    try:
        resp = await client.get(f"{TRAIL_CONDITION_URL}/hazards/trail/{trail_id}", timeout=TIMEOUT)
        resp.raise_for_status()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        all_hazards = resp.json().get("hazards", [])
        return [
            h for h in all_hazards
            if _within_24h(h.get("reported_at", ""), cutoff)
        ]
    except Exception as e:
        log.warning("Trail Condition Service (hazards) unavailable: %s", e)
        return []


async def _reverse_geocode(client: httpx.AsyncClient, lat: str, lon: str) -> str:
    """Convert lat/lon strings to a human-readable address via GoogleMaps wrapper."""
    if not lat or not lon:
        return "reported location"
    cache_key = f"{lat},{lon}"
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]
    try:
        r = await client.get(
            f"{GOOGLEMAPS_URL}/reverse-geocode",
            params={"lat": lat, "lng": lon},
            timeout=httpx.Timeout(5.0),
        )
        if r.status_code == 200:
            addr = r.json().get("formattedAddress", "")
            if addr:
                _geocode_cache[cache_key] = addr
                return addr
    except Exception as e:
        log.warning("Reverse geocode %s,%s failed: %s", lat, lon, e)
    fallback = f"{lat}, {lon}"
    _geocode_cache[cache_key] = fallback
    return fallback


def _within_24h(reported_at: str, cutoff: datetime) -> bool:
    try:
        ts = datetime.fromisoformat(reported_at.replace("Z", "+00:00"))
        return ts >= cutoff
    except Exception:
        return True  # include if timestamp unparseable


def _parse_incident(raw: dict) -> RecentIncident:
    loc = raw.get("location")
    location = None
    if isinstance(loc, dict):
        location = IncidentLocation(lat=loc.get("lat", 0.0), lng=loc.get("lng", 0.0))
    return RecentIncident(
        incident_id=raw.get("incidentId", raw.get("id", "")),
        injury_type=raw.get("injuryType", "Unknown"),
        severity=int(raw.get("severity", 1)),
        description=raw.get("description", ""),
        reported_at=str(raw.get("reportedAt", "")),
        location=location,
    )


# ── Query ─────────────────────────────────────────────────────────────────────

@strawberry.type
class Query:
    @strawberry.field(
        description="Fetch trail conditions, user-reported hazards, and recent incidents in a single query."
    )
    async def trail_dashboard(self, trail_id: str) -> TrailDashboard:
        log.info("GraphQL trailDashboard query | trailId=%s", trail_id)

        async with httpx.AsyncClient() as client:
            condition, raw_incidents, raw_hazards = await asyncio.gather(
                _fetch_trail_condition(client, trail_id),
                _fetch_incidents(client, trail_id),
                _fetch_reported_hazards(client, trail_id),
            )

            # Geocode all hazard locations concurrently (must be inside the client context)
            raw_details = condition.get("hazardDetails", [])
            geocoded_locations = await asyncio.gather(*[
                _reverse_geocode(client, h.get("lat", ""), h.get("lon", ""))
                for h in raw_details
            ])

        # Filter incidents to last 24 hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent = [
            _parse_incident(inc) for inc in raw_incidents
            if _within_24h(inc.get("reportedAt", ""), cutoff)
        ]

        hazard_details = [
            HazardDetail(
                type=h.get("type", "unknown"),
                severity=str(h.get("severity", "minor")),
                location=addr,
                description=h.get("description") or None,
                reported_at=str(h["reported_at"]) if h.get("reported_at") else None,
            )
            for h, addr in zip(raw_details, geocoded_locations)
        ]

        reported_hazards = [
            ReportedHazard(
                hazard_id=h.get("hazard_id", ""),
                hazard_type=h.get("hazard_type", "Unknown"),
                severity=int(h.get("severity", 1)),
                description=h.get("description", ""),
                reported_at=str(h.get("reported_at", "")),
            )
            for h in raw_hazards
        ]

        log.info(
            "GraphQL trailDashboard resolved | trailId=%s status=%s incidents=%d reportedHazards=%d",
            trail_id, condition.get("operationalStatus", "UNKNOWN"), len(recent), len(reported_hazards),
        )

        return TrailDashboard(
            trail_id=condition.get("trailId", trail_id),
            name=condition.get("name", f"Trail #{trail_id}"),
            operational_status=condition.get("operationalStatus", "UNKNOWN"),
            difficulty=condition.get("difficulty", "unknown"),
            active_hazards=condition.get("activeHazards", 0),
            hazard_details=hazard_details,
            reported_hazards=reported_hazards,
            is_closed=condition.get("isClosed", False),
            last_updated=condition.get("lastUpdated"),
            recent_incidents=recent,
            distance_km=condition.get("distanceKm"),
            estimated_duration_mins=condition.get("estimatedDurationMins"),
            recommended_pace_mins_per_km=condition.get("recommendedPaceMinsPerKm"),
        )


# ── FastAPI app ───────────────────────────────────────────────────────────────

schema = strawberry.Schema(query=Query)

app = FastAPI(title="TRAILGUARD – Trail Query Service (GraphQL)", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_router = GraphQLRouter(schema, graphiql=True)
app.include_router(graphql_router, prefix="/graphql")


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Trail_Query_Service", "api": "GraphQL"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "Trail_Query_Service:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8011)),
        reload=True,
    )
