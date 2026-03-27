"""
TRAILGUARD – Weather Wrapper  (External API Wrapper)
Port: 8005

Calls an external Weather API (Open-Meteo – free, no key required),
then normalises the response into TRAILGUARD's internal schema.

Normalised output schema:
{
  trailId, date, time,
  temperatureC, feelsLikeC,
  humidity,          # 0–100 %
  windSpeedKph,
  precipitationMm,
  uvIndex,
  visibility,        # "good" | "moderate" | "poor"
  severity,          # "clear" | "cloudy" | "drizzle" | "rain" | "storm" | "extreme"
  conditions,        # human-readable summary
  safetyFlags        # list of flags derived from the data
}
"""

import os
import logging
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger("WeatherWrapper")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TRAILGUARD – Weather Wrapper", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Trail → GPS coordinate mapping ───────────────────────────────────────────
TRAIL_COORDS: dict[str, tuple[float, float]] = {
    "1":  (1.2742, 103.8089),  # Southern Ridges Loop
    "2":  (1.3441, 103.8198),  # MacRitchie Reservoir Trail
    "3":  (1.3520, 103.7767),  # Bukit Timah Summit Trail
    "4":  (1.2650, 103.8025),  # Labrador Nature Reserve Trail
    "5":  (1.4473, 103.7237),  # Sungei Buloh Wetland Walk
    "6":  (1.3474, 103.7597),  # Bukit Batok Nature Park Loop
    "7":  (1.4044, 103.9592),  # Pulau Ubin Chek Jawa Trail
    "8":  (1.2933, 103.7837),  # Kent Ridge Park Trail
    "9":  (1.4410, 103.7983),  # Admiralty Park Mangrove Trail
    "10": (1.3241, 103.7681),  # Clementi Forest Trail
}

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = httpx.Timeout(10.0, connect=4.0)


# ── WMO Weather Code → TRAILGUARD severity mapping ───────────────────────────
def _wmo_to_severity(code: int) -> str:
    if code == 0:                          return "clear"
    if code in range(1, 4):               return "cloudy"
    if code in range(51, 58):             return "drizzle"
    if code in range(61, 68):             return "rain"
    if code in range(71, 78):             return "rain"    # snow → treat as rain for tropics
    if code in range(80, 83):             return "rain"
    if code in range(95, 100):            return "storm"
    return "cloudy"


def _wmo_to_description(code: int) -> str:
    descriptions = {
        0:  "Clear sky",
        1:  "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
        61: "Slight rain",  63: "Moderate rain",   65: "Heavy rain",
        80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
    }
    return descriptions.get(code, f"Weather code {code}")


def _derive_safety_flags(data: dict) -> list[str]:
    flags = []
    if data["temperatureC"] > 35:
        flags.append("HIGH_HEAT_RISK")
    if data["temperatureC"] < 5:
        flags.append("HYPOTHERMIA_RISK")
    if data["windSpeedKph"] > 50:
        flags.append("HIGH_WIND_WARNING")
    if data["precipitationMm"] > 10:
        flags.append("HEAVY_PRECIPITATION")
    if data["uvIndex"] >= 8:
        flags.append("EXTREME_UV")
    if data["severity"] in ("storm", "extreme"):
        flags.append("SEVERE_WEATHER_WARNING")
    if data["humidity"] > 90:
        flags.append("HIGH_HUMIDITY")
    return flags


def _visibility_from_data(wind: float, precip: float) -> str:
    if precip > 5 or wind > 60:
        return "poor"
    if precip > 1 or wind > 30:
        return "moderate"
    return "good"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.get("/weather", tags=["Weather"])
async def get_weather(
    trailId: str = Query(..., description="Trail identifier"),
    date:    str = Query(..., description="YYYY-MM-DD"),
    time:    str = Query(..., description="HH:MM"),
):
    coords = TRAIL_COORDS.get(trailId)
    if not coords:
        raise HTTPException(status_code=404, detail=f"Trail '{trailId}' not found in coordinate map.")

    lat, lon = coords
    hour = int(time.split(":")[0])

    params = {
        "latitude":        lat,
        "longitude":       lon,
        "hourly":          ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
                            "wind_speed_10m", "precipitation", "uv_index", "weather_code"],
        "daily":           [],
        "forecast_days":   7,
        "timezone":        "auto",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(OPEN_METEO_URL, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
            raw = resp.json()
        except httpx.RequestError as e:
            log.error("Open-Meteo request failed: %s", e)
            raise HTTPException(status_code=503, detail="Weather service unavailable.")

    # Find the index for the requested date+hour
    times: list[str] = raw["hourly"]["time"]
    target = f"{date}T{hour:02d}:00"
    try:
        idx = times.index(target)
    except ValueError:
        # Fallback: use first available slot
        idx = 0

    hourly = raw["hourly"]
    wmo_code = hourly["weather_code"][idx]

    normalized = {
        "trailId":        trailId,
        "date":           date,
        "time":           time,
        "temperatureC":   hourly["temperature_2m"][idx],
        "feelsLikeC":     hourly["apparent_temperature"][idx],
        "humidity":       hourly["relative_humidity_2m"][idx],
        "windSpeedKph":   hourly["wind_speed_10m"][idx],
        "precipitationMm":hourly["precipitation"][idx],
        "uvIndex":        hourly["uv_index"][idx],
        "wmoCode":        wmo_code,
        "severity":       _wmo_to_severity(wmo_code),
        "conditions":     _wmo_to_description(wmo_code),
        "visibility":     _visibility_from_data(
                              hourly["wind_speed_10m"][idx],
                              hourly["precipitation"][idx]
                          ),
        "source":         "Open-Meteo",
    }
    normalized["safetyFlags"] = _derive_safety_flags(normalized)

    return normalized


@app.get("/health", tags=["Ops"])
async def health():
    return {"status": "ok", "service": "Weather_Wrapper"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Weather_Wrapper:app", host="0.0.0.0",
                port=int(os.getenv("PORT", 8005)), reload=True)
