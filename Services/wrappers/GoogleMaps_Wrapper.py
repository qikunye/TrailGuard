"""
TRAILGUARD – Google Maps Wrapper  (External API Wrapper)
Port: 8007

Wraps the Google Maps Platform REST APIs and normalises responses
into TRAILGUARD's internal schema.

Endpoints
─────────
GET /reverse-geocode   lat, lng  →  human-readable address + location metadata
GET /geocode           address   →  coordinates + place metadata
GET /distance-matrix   origins / destinations  →  distance + duration matrix
GET /nearby-emergency  lat, lng  →  nearby hospitals, fire stations, police
GET /health
"""

import os
import logging
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger("GoogleMapsWrapper")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TRAILGUARD – Google Maps Wrapper", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
TIMEOUT = httpx.Timeout(10.0, connect=4.0)

GEOCODE_URL       = "https://maps.googleapis.com/maps/api/geocode/json"
DISTANCE_URL      = "https://maps.googleapis.com/maps/api/distancematrix/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

EMERGENCY_TYPES = ["hospital", "fire_station", "police"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_key():
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_MAPS_API_KEY not configured.")


def _check_status(data: dict, endpoint: str):
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(
            status_code=502,
            detail=f"Google Maps {endpoint} returned status: {status}",
        )


def _parse_address_components(components: list) -> dict:
    """Extract structured fields from Google's address_components list."""
    result = {}
    type_map = {
        "country":                       "country",
        "administrative_area_level_1":   "state",
        "locality":                      "city",
        "sublocality_level_1":           "district",
        "route":                         "street",
        "postal_code":                   "postalCode",
        "natural_feature":               "naturalFeature",
        "park":                          "park",
    }
    for component in components:
        for t in component.get("types", []):
            if t in type_map:
                result[type_map[t]] = component["long_name"]
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/reverse-geocode", tags=["Location"])
async def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """
    Convert GPS coordinates to a human-readable address.
    Used by Incident Reporting Service to get the user's current location.

    Returns:
        formattedAddress, addressComponents, plusCode, locationType
    """
    _check_key()

    params = {
        "latlng":      f"{lat},{lng}",
        "result_type": "street_address|route|natural_feature|park|point_of_interest",
        "key":         GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(GEOCODE_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except httpx.RequestError as e:
            log.error("Reverse-geocode request failed: %s", e)
            raise HTTPException(status_code=503, detail="Google Maps API unreachable.")

    data = resp.json()
    _check_status(data, "reverse-geocode")

    results = data.get("results", [])
    if not results:
        return {
            "lat": lat,
            "lng": lng,
            "formattedAddress": f"{lat:.6f}, {lng:.6f}",
            "addressComponents": {},
            "plusCode": None,
            "locationType": "APPROXIMATE",
        }

    best = results[0]
    return {
        "lat":               lat,
        "lng":               lng,
        "formattedAddress":  best.get("formatted_address", ""),
        "addressComponents": _parse_address_components(best.get("address_components", [])),
        "plusCode":          best.get("plus_code", {}).get("global_code"),
        "locationType":      best.get("geometry", {}).get("location_type", "APPROXIMATE"),
        "placeId":           best.get("place_id"),
    }


@app.get("/geocode", tags=["Location"])
async def geocode(
    address: str = Query(..., description="Trail name or address to geocode"),
    region:  str = Query("SG", description="Region bias (ISO 3166-1 alpha-2)"),
):
    """
    Convert a trail name / address to GPS coordinates.
    Used by Report Ingestion and Alternative Route Service to get trail location.

    Returns:
        lat, lng, formattedAddress, placeId, locationType, bounds
    """
    _check_key()

    params = {
        "address": address,
        "region":  region,
        "key":     GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(GEOCODE_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except httpx.RequestError as e:
            log.error("Geocode request failed: %s", e)
            raise HTTPException(status_code=503, detail="Google Maps API unreachable.")

    data = resp.json()
    _check_status(data, "geocode")

    results = data.get("results", [])
    if not results:
        raise HTTPException(status_code=404, detail=f"No results for address: '{address}'")

    best     = results[0]
    location = best["geometry"]["location"]
    bounds   = best["geometry"].get("bounds") or best["geometry"].get("viewport")

    return {
        "lat":               location["lat"],
        "lng":               location["lng"],
        "formattedAddress":  best.get("formatted_address", ""),
        "addressComponents": _parse_address_components(best.get("address_components", [])),
        "placeId":           best.get("place_id"),
        "locationType":      best["geometry"].get("location_type", "APPROXIMATE"),
        "bounds": {
            "northeast": bounds["northeast"],
            "southwest": bounds["southwest"],
        } if bounds else None,
    }


AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"

@app.get("/autocomplete", tags=["Location"])
async def autocomplete(
    input: str = Query(..., description="Search text"),
):
    """
    Suggest place names as the user types.
    Used by the frontend for start/end location inputs.
    """
    _check_key()

    params = {
        "input":      input,
        "location":   "1.3521,103.8198",   # bias toward Singapore
        "radius":     50000,
        "components": "country:sg",
        "key":        GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(AUTOCOMPLETE_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except httpx.RequestError as e:
            log.error("Autocomplete request failed: %s", e)
            raise HTTPException(status_code=503, detail="Google Maps API unreachable.")

    data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(status_code=502, detail=f"Autocomplete status: {data.get('status')}")

    return {
        "predictions": [
            {
                "description":   p["description"],
                "placeId":       p["place_id"],
                "mainText":      p["structured_formatting"]["main_text"],
                "secondaryText": p["structured_formatting"].get("secondary_text", ""),
            }
            for p in data.get("predictions", [])
        ]
    }


DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


def _decode_polyline(encoded: str) -> list:
    """Decode a Google Maps encoded polyline into [[lat, lng], ...] pairs."""
    coords, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
            else:
                lat += delta
        coords.append([lat / 1e5, lng / 1e5])
    return coords


@app.get("/directions", tags=["Routing"])
async def directions(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lng: float = Query(..., description="Origin longitude"),
    dest_lat:   float = Query(..., description="Destination latitude"),
    dest_lng:   float = Query(..., description="Destination longitude"),
    mode:       str   = Query("walking", description="Travel mode: walking | driving | bicycling | transit"),
):
    """
    Get a full walking route from Google Maps Directions API.
    Returns distance, duration, and decoded path coordinates for map rendering.
    """
    _check_key()

    params = {
        "origin":      f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode":        mode,
        "key":         GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(DIRECTIONS_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except httpx.RequestError as e:
            log.error("Directions request failed: %s", e)
            raise HTTPException(status_code=503, detail="Google Maps API unreachable.")

    data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(status_code=502, detail=f"Directions status: {data.get('status')}")
    if not data.get("routes"):
        raise HTTPException(status_code=404, detail="No route found.")

    route = data["routes"][0]
    leg   = route["legs"][0]

    path = _decode_polyline(route["overview_polyline"]["points"])

    return {
        "distanceMetres":  leg["distance"]["value"],
        "distanceText":    leg["distance"]["text"],
        "durationSeconds": leg["duration"]["value"],
        "durationText":    leg["duration"]["text"],
        "path":            path,
    }


@app.get("/distance-matrix", tags=["Routing"])
async def distance_matrix(
    origin_lat:  float = Query(..., description="Origin latitude"),
    origin_lng:  float = Query(..., description="Origin longitude"),
    dest_lat:    float = Query(..., description="Destination latitude"),
    dest_lng:    float = Query(..., description="Destination longitude"),
    mode:        str   = Query("walking", description="Travel mode: walking | driving | bicycling | transit"),
):
    """
    Get distance and estimated travel time between two coordinates.
    Used by Alternative Route Service to assess the nearest alternative trail.

    Returns:
        distanceMetres, distanceText, durationSeconds, durationText, status
    """
    _check_key()

    params = {
        "origins":      f"{origin_lat},{origin_lng}",
        "destinations": f"{dest_lat},{dest_lng}",
        "mode":         mode,
        "key":          GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(DISTANCE_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except httpx.RequestError as e:
            log.error("Distance Matrix request failed: %s", e)
            raise HTTPException(status_code=503, detail="Google Maps API unreachable.")

    data = resp.json()
    _check_status(data, "distance-matrix")

    try:
        element = data["rows"][0]["elements"][0]
    except (IndexError, KeyError):
        raise HTTPException(status_code=502, detail="Malformed Distance Matrix response.")

    el_status = element.get("status")
    if el_status != "OK":
        raise HTTPException(status_code=404, detail=f"Route not found. Element status: {el_status}")

    return {
        "originLat":      origin_lat,
        "originLng":      origin_lng,
        "destLat":        dest_lat,
        "destLng":        dest_lng,
        "mode":           mode,
        "distanceMetres": element["distance"]["value"],
        "distanceText":   element["distance"]["text"],
        "durationSeconds":element["duration"]["value"],
        "durationText":   element["duration"]["text"],
        "status":         el_status,
    }


@app.get("/nearby-emergency", tags=["Emergency"])
async def nearby_emergency(
    lat:    float = Query(..., description="Latitude of the incident"),
    lng:    float = Query(..., description="Longitude of the incident"),
    radius: int   = Query(5000, description="Search radius in metres (max 50000)"),
):
    """
    Find the nearest emergency services (hospitals, fire stations, police).
    Used by Incident Reporting Service to locate help near the hiker.

    Returns:
        List of nearby emergency places sorted by distance approximation.
    """
    _check_key()

    results = []

    async with httpx.AsyncClient() as client:
        for place_type in EMERGENCY_TYPES:
            params = {
                "location": f"{lat},{lng}",
                "radius":   min(radius, 50000),
                "type":     place_type,
                "key":      GOOGLE_MAPS_API_KEY,
            }
            try:
                resp = await client.get(PLACES_NEARBY_URL, params=params, timeout=TIMEOUT)
                resp.raise_for_status()
                data = resp.json()
            except httpx.RequestError as e:
                log.warning("Places Nearby request failed for type %s: %s", place_type, e)
                continue

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                log.warning("Places Nearby returned status %s for type %s", data.get("status"), place_type)
                continue

            for place in data.get("results", [])[:3]:   # top 3 per category
                loc = place.get("geometry", {}).get("location", {})
                results.append({
                    "name":       place.get("name"),
                    "type":       place_type,
                    "address":    place.get("vicinity"),
                    "lat":        loc.get("lat"),
                    "lng":        loc.get("lng"),
                    "placeId":    place.get("place_id"),
                    "openNow":    place.get("opening_hours", {}).get("open_now"),
                    "rating":     place.get("rating"),
                })

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No emergency services found within {radius}m of ({lat}, {lng}).",
        )

    return {
        "incidentLat": lat,
        "incidentLng": lng,
        "radiusMetres": radius,
        "count": len(results),
        "results": results,
    }


@app.get("/health", tags=["Ops"])
async def health():
    return {
        "status":  "ok",
        "service": "GoogleMaps_Wrapper",
        "keyConfigured": bool(GOOGLE_MAPS_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "GoogleMaps_Wrapper:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8007)),
        reload=True,
    )
