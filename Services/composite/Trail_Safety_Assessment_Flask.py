"""
TRAILGUARD – Trail Safety Assessment Composite Service  (Flask)
Port: 8008

This is a Flask-based composite/orchestrator service that mirrors the flow
in the FastAPI orchestrator (port 8000) but is deliberately independent —
no code from any other service is imported or modified.

Flow triggered when the user clicks "Check Trail" on the Register Hike page:

  Step 1 : GET /Capability/{userId}           → hiker-profile:8001
  Step 2 : GET /weather                        → weather-wrapper:8005
  Step 3 : GET /Condition/{trailId}            → trail-condition:8002
  Step 4 : GET /GetTrail/{trailId}             → trail-condition:8002
  Step 5 : GET /GetRecentIncidents/{id}/30     → incident-risk:8003
  Step 6 : GET /GetRecentIncidents/{id}/90     → incident-risk:8003
  (Steps 2-6 are fired concurrently via ThreadPoolExecutor)
  Step 7 : POST /estimate                      → hike-completion:8004
  Step 8 : POST /evaluate                      → evaluator-wrapper:8006
           Gemini/OpenAI outputs finalDecision: GO | CAUTION | DO_NOT_GO

The service is STATELESS — nothing is persisted.
"""

import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
log = logging.getLogger("TrailSafetyFlask")

# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow all origins (matches FastAPI orchestrator behaviour)

# ── Downstream service URLs ───────────────────────────────────────────────────
HIKER_PROFILE_URL     = os.getenv("HIKER_PROFILE_URL",     "http://localhost:8001")
TRAIL_CONDITION_URL   = os.getenv("TRAIL_CONDITION_URL",   "http://localhost:8002")
INCIDENT_RISK_URL     = os.getenv("INCIDENT_RISK_URL",     "http://localhost:8003")
HIKE_COMPLETION_URL   = os.getenv("HIKE_COMPLETION_URL",   "http://localhost:8004")
WEATHER_WRAPPER_URL   = os.getenv("WEATHER_WRAPPER_URL",   "http://localhost:8005")
EVALUATOR_WRAPPER_URL = os.getenv("EVALUATOR_WRAPPER_URL", "http://localhost:8006")

REQUEST_TIMEOUT = 15  # seconds


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _get(url: str, params: dict = None) -> dict:
    """Synchronous GET with error surfacing."""
    try:
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as exc:
        log.error("Upstream HTTP error [GET %s]: %s", url, exc)
        raise RuntimeError(f"Upstream error from {url}: HTTP {exc.response.status_code}") from exc
    except requests.ConnectionError as exc:
        log.error("Connection error [GET %s]: %s", url, exc)
        raise RuntimeError(f"Cannot reach service at {url}") from exc
    except requests.Timeout as exc:
        log.error("Timeout [GET %s]", url)
        raise RuntimeError(f"Timeout reaching service at {url}") from exc


def _post(url: str, payload: dict) -> dict:
    """Synchronous POST with error surfacing."""
    try:
        resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as exc:
        log.error("Upstream HTTP error [POST %s]: %s", url, exc)
        raise RuntimeError(f"Upstream error from {url}: HTTP {exc.response.status_code}") from exc
    except requests.ConnectionError as exc:
        log.error("Connection error [POST %s]: %s", url, exc)
        raise RuntimeError(f"Cannot reach service at {url}") from exc
    except requests.Timeout as exc:
        log.error("Timeout [POST %s]", url)
        raise RuntimeError(f"Timeout reaching service at {url}") from exc


# ── Request validation helper ─────────────────────────────────────────────────

REQUIRED_FIELDS = {"userId", "trailId", "plannedDate", "plannedStartTime", "declaredExpLevel"}
VALID_EXP_LEVELS = {"beginner", "intermediate", "advanced", "expert"}


def _validate_request(body: dict) -> list[str]:
    """Return a list of validation error messages (empty = valid)."""
    errors = []
    missing = REQUIRED_FIELDS - body.keys()
    if missing:
        errors.append(f"Missing required fields: {', '.join(sorted(missing))}")
    exp = body.get("declaredExpLevel", "")
    if exp and exp not in VALID_EXP_LEVELS:
        errors.append(
            f"declaredExpLevel must be one of: {', '.join(sorted(VALID_EXP_LEVELS))}. Got: '{exp}'"
        )
    return errors


# ── Main endpoint ─────────────────────────────────────────────────────────────

@app.route("/assess-trail-flask", methods=["POST"])
def assess_trail():
    """
    Composite Trail Safety Assessment endpoint (Flask).

    Accepts JSON body:
        userId           – hiker's registered user ID
        trailId          – trail identifier
        plannedDate      – "YYYY-MM-DD"
        plannedStartTime – "HH:MM"
        declaredExpLevel – beginner | intermediate | advanced | expert

    Returns the full assessment response including finalDecision (GO/CAUTION/DO_NOT_GO),
    AI reasoning, key reasons, warnings, weather, trail conditions, incident data,
    hiker profile, and completion estimate.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    errors = _validate_request(body)
    if errors:
        return jsonify({"error": "; ".join(errors)}), 422

    user_id     = body["userId"]
    trail_id    = body["trailId"]
    planned_date  = body["plannedDate"]
    planned_time  = body["plannedStartTime"]
    declared_exp  = body["declaredExpLevel"]
    request_id    = str(uuid.uuid4())

    log.info("▶ [Flask] Assessment started | requestId=%s userId=%s trailId=%s",
             request_id, user_id, trail_id)

    # ── Step 1: Hiker Profile ─────────────────────────────────────────────────
    # GET /Capability/{userId} → HikerProfileAPI (atomic, port 8001)
    log.info("Step 1 – GET Capability userId=%s", user_id)
    try:
        hiker_raw = _get(f"{HIKER_PROFILE_URL}/Capability/{user_id}")
    except RuntimeError as exc:
        return jsonify({"error": str(exc), "step": "hiker-profile"}), 502

    if not hiker_raw.get("Success", True):
        # Hiker not in DB — derive from declaredExpLevel as fallback
        log.warning("Hiker '%s' not found — falling back to declaredExpLevel '%s'",
                    user_id, declared_exp)
        _fitness_map = {
            "beginner":     "low",
            "intermediate": "medium",
            "advanced":     "high",
            "expert":       "high",
        }
        hiker_raw = {
            "fitnessLevel":        _fitness_map.get(declared_exp, "medium"),
            "experienceRating":    declared_exp,
            "totalHikesCompleted": 0,
            "typicalPace":         15,
            "Success":             True,
            "ErrorCode":           0,
        }

    # Strict: keep only Swagger-contract fields from HikerProfileAPI/Capability
    hiker_profile = {
        "fitnessLevel":        hiker_raw.get("fitnessLevel"),
        "experienceRating":    hiker_raw.get("experienceRating"),
        "totalHikesCompleted": hiker_raw.get("totalHikesCompleted"),
        "typicalPace":         hiker_raw.get("typicalPace"),
    }
    log.info("Step 1 ✓ hiker=%s", hiker_profile)

    # ── Steps 2-6: Concurrent I/O-bound calls ─────────────────────────────────
    # Flask is synchronous, so we use ThreadPoolExecutor to parallelize HTTP calls.
    log.info("Steps 2-6 – Concurrent fetch: weather / condition / trail / incidents×2")

    def fetch_weather():
        return _get(
            f"{WEATHER_WRAPPER_URL}/weather",
            params={"trailId": trail_id, "date": planned_date, "time": planned_time},
        )

    def fetch_condition():
        # GET /Condition/{trailId} — TrailConditionAPI (Swagger-contract)
        return _get(f"{TRAIL_CONDITION_URL}/Condition/{trail_id}")

    def fetch_trail_meta():
        # GET /GetTrail/{trailId} — TrailDBAPI (Swagger-contract)
        return _get(f"{TRAIL_CONDITION_URL}/GetTrail/{trail_id}")

    def fetch_incidents_30():
        # GET /GetRecentIncidents/{id}/30 — IncidentsAPI (Swagger-contract)
        return _get(f"{INCIDENT_RISK_URL}/GetRecentIncidents/{trail_id}/30")

    def fetch_incidents_90():
        # GET /GetRecentIncidents/{id}/90 — IncidentsAPI (Swagger-contract)
        return _get(f"{INCIDENT_RISK_URL}/GetRecentIncidents/{trail_id}/90")

    concurrent_tasks = {
        "weather":       fetch_weather,
        "condition":     fetch_condition,
        "trail_meta":    fetch_trail_meta,
        "incidents_30":  fetch_incidents_30,
        "incidents_90":  fetch_incidents_90,
    }

    results = {}
    errors_concurrent = {}

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_key = {executor.submit(fn): key for key, fn in concurrent_tasks.items()}
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                results[key] = future.result()
            except RuntimeError as exc:
                errors_concurrent[key] = str(exc)

    if errors_concurrent:
        log.error("Concurrent fetch errors: %s", errors_concurrent)
        return jsonify({
            "error":   "One or more upstream services failed",
            "details": errors_concurrent,
        }), 502

    weather_data      = results["weather"]
    condition_raw     = results["condition"]
    trail_meta_raw    = results["trail_meta"]
    incidents_30_raw  = results["incidents_30"]
    incidents_90_raw  = results["incidents_90"]
    log.info("Steps 2-6 ✓")

    # Strict: keep only Swagger-contract fields for each response

    # TrailConditionAPI/Condition
    trail_conditions = {
        "operationalStatus":  condition_raw.get("operationalStatus"),
        "activeHazardCounts": condition_raw.get("activeHazardCounts"),
        "highestSeverity":    condition_raw.get("highestSeverity"),
        "hazardTypes":        condition_raw.get("hazardTypes", []),
    }

    # TrailDBAPI/GetTrail
    trail_meta = {
        "trailId":           trail_meta_raw.get("trailId"),
        "trailName":         trail_meta_raw.get("trailName"),
        "difficulty":        trail_meta_raw.get("difficulty"),
        "operationalStatus": trail_meta_raw.get("operationalStatus"),
    }

    # IncidentsAPI/GetRecentIncidents — only incidentCount per Swagger
    incident_data = {
        "incidentCount30Days": incidents_30_raw.get("incidentCount", 0),
        "incidentCount90Days": incidents_90_raw.get("incidentCount", 0),
    }

    log.info("Steps 2-6 ✓ conditions=%s trail=%s incidents=%s",
             trail_conditions, trail_meta, incident_data)

    # Guard: closed trail → force DO_NOT_GO regardless of AI output
    is_closed = (
        trail_conditions.get("operationalStatus") == "closed"
        or trail_meta.get("operationalStatus") == "closed"
    )

    # ── Step 7: Hike Completion Estimate ──────────────────────────────────────
    # POST /estimate → hike-completion:8004 (internal atomic service)
    # Internally this simulates the GoogleMaps-style duration estimation using
    # historical records, hiker fitness, trail conditions, and weather severity.
    log.info("Step 7 – POST /estimate for hike completion")
    try:
        completion_estimate = _post(
            f"{HIKE_COMPLETION_URL}/estimate",
            payload={
                "trailId":          trail_id,
                "plannedStartTime": planned_time,
                # Only Swagger-backed fields forwarded downstream:
                "hikerProfile":     hiker_profile,      # fitnessLevel (Swagger)
                "trailConditions":  trail_conditions,   # highestSeverity, activeHazardCounts (Swagger)
                "weatherData":      weather_data,        # severity (Weather Wrapper internal)
            },
        )
    except RuntimeError as exc:
        return jsonify({"error": str(exc), "step": "hike-completion"}), 502
    log.info("Step 7 ✓ estimate=%s", completion_estimate)

    # ── Step 8: AI Evaluation (OpenAI / rule-based fallback) ──────────────────
    # POST /evaluate → evaluator-wrapper:8006 (LLM wrapper)
    # The evaluator calls OpenAI (GPT-4o-mini) and returns finalDecision.
    log.info("Step 8 – POST /evaluate for AI safety decision")
    evaluator_payload = {
        "userId":             user_id,
        "trailId":            trail_id,
        "plannedDate":        planned_date,
        "plannedStartTime":   planned_time,
        "declaredExpLevel":   declared_exp,
        # Swagger-backed hiker fields only
        "hikerProfile":       hiker_profile,
        # Weather Wrapper fields (internal service)
        "weatherData":        weather_data,
        # Swagger-backed trail fields
        "trailConditions":    trail_conditions,
        "trailMeta":          trail_meta,
        # Swagger-backed incident fields (incidentCount only)
        "incidentData":       incident_data,
        "completionEstimate": completion_estimate,
        "isTrailClosed":      is_closed,
    }
    try:
        evaluation = _post(f"{EVALUATOR_WRAPPER_URL}/evaluate", payload=evaluator_payload)
    except RuntimeError as exc:
        return jsonify({"error": str(exc), "step": "evaluator-wrapper"}), 502
    log.info("Step 8 ✓ finalDecision=%s", evaluation.get("finalDecision"))

    # ── Step 9: Collate and return ────────────────────────────────────────────
    # Override decision if trail is closed, regardless of AI output
    final_decision = evaluation.get("finalDecision", "CAUTION")
    if is_closed and final_decision != "DO_NOT_GO":
        final_decision = "DO_NOT_GO"
        warnings = evaluation.get("warnings", [])
        if "Trail is closed." not in warnings:
            warnings.insert(0, "Trail is closed.")
        evaluation["warnings"] = warnings

    response_body = {
        # ── Request echo ──
        "requestId":         request_id,
        "userId":            user_id,
        "trailId":           trail_id,
        "plannedDate":       planned_date,
        "plannedStartTime":  planned_time,
        # ── Upstream data (Swagger-contract fields only) ──
        "hikerProfile":      hiker_profile,
        "weatherData":       weather_data,
        "trailConditions":   trail_conditions,
        "trailMeta":         trail_meta,
        "incidentData":      incident_data,
        "completionEstimate":completion_estimate,
        # ── AI evaluation output ──
        "finalDecision":     final_decision,           # GO | CAUTION | DO_NOT_GO
        "confidenceScore":   float(evaluation.get("confidenceScore", 0.75)),
        "reasoning":         evaluation.get("reasoning", ""),
        "keyReasons":        evaluation.get("keyReasons", []),
        "warnings":          evaluation.get("warnings", []),
        # ── Metadata ──
        "evaluatedAt":       datetime.now(timezone.utc).isoformat(),
        "serviceVersion":    "1.0.0-flask",
    }

    log.info("◀ [Flask] Assessment complete | requestId=%s decision=%s",
             request_id, final_decision)
    return jsonify(response_body), 200


# ── Health check ──────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":  "ok",
        "service": "Trail_Safety_Assessment_Flask",
        "version": "1.0.0-flask",
        "port":    int(os.getenv("PORT", 8008)),
    }), 200


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8008))
    log.info("Starting Trail Safety Assessment Flask service on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
