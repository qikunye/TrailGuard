"""
TRAILGUARD – Emergency Notification Wrapper  (External API Wrapper)
Port: 8008

Receives a dispatch request from the Incident Reporting Service and triggers
a real Twilio voice call to the configured emergency number.

Input (POST /dispatch):
{
  incidentId,   – unique incident identifier
  hikerId,      – hiker who triggered the alert
  description,  – free-text description of the incident
  severity,     – "critical" | "high" | "medium" | "low"
  lat,          – hiker latitude
  lng           – hiker longitude
}

Output:
{
  incidentId,
  status,       – "DISPATCHED" | "FAILED"
  callSid,      – Twilio call SID (present on success)
  timestamp
}
"""

import os
import logging
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("EmergencyNotifWrapper")

# ── Twilio config ─────────────────────────────────────────────────────────────

TWILIO_ACCOUNT_SID   = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER   = os.environ.get("TWILIO_FROM_NUMBER")   # Your Twilio number  e.g. +1650XXXXXXX
EMERGENCY_TO_NUMBER  = "+13186574250"

_missing = [k for k, v in {
    "TWILIO_ACCOUNT_SID":  TWILIO_ACCOUNT_SID,
    "TWILIO_AUTH_TOKEN":   TWILIO_AUTH_TOKEN,
    "TWILIO_FROM_NUMBER":  TWILIO_FROM_NUMBER,
    "EMERGENCY_TO_NUMBER": EMERGENCY_TO_NUMBER,
}.items() if not v]

if _missing:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing)}")

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

REQUIRED_FIELDS = ["incidentId", "hikerId", "description", "severity", "lat", "lng"]


# ── TwiML voice message ───────────────────────────────────────────────────────

def _build_twiml(payload: dict) -> str:
    """
    Returns a TwiML string that Twilio will speak when the call is answered.
    Uses <Say> with a clear read-out of the incident details.
    """
    severity  = str(payload.get("severity", "unknown")).upper()
    hiker_id  = payload.get("hikerId", "unknown")
    desc      = payload.get("description", "No description provided.")
    lat       = payload.get("lat", 0)
    lng       = payload.get("lng", 0)
    incident  = payload.get("incidentId", "unknown")

    message = (
        f"TrailGuard emergency alert. "
        f"Incident ID: {incident}. "
        f"Hiker ID: {hiker_id}. "
        f"Severity: {severity}. "
        f"Description: {desc}. "
        f"Location: latitude {lat}, longitude {lng}. "
        f"Please respond immediately."
    )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US" loop="2">{message}</Say>
</Response>"""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.route("/dispatch", methods=["POST"])
def dispatch():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "Request body must be valid JSON"}), 400

    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing)}"}), 400

    incident_id = data["incidentId"]
    log.info("▶ Dispatch received | incidentId=%s hikerId=%s severity=%s",
             incident_id, data["hikerId"], data["severity"])

    twiml = _build_twiml(data)

    try:
        call = twilio_client.calls.create(
            twiml=twiml,
            to=EMERGENCY_TO_NUMBER,
            from_=TWILIO_FROM_NUMBER,
        )
        log.info("✓ Twilio call initiated | callSid=%s to=%s", call.sid, EMERGENCY_TO_NUMBER)

        return jsonify({
            "incidentId": incident_id,
            "status":     "DISPATCHED",
            "callSid":    call.sid,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        }), 200

    except TwilioRestException as e:
        log.error("✗ Twilio call failed | incidentId=%s error=%s", incident_id, e)
        return jsonify({
            "incidentId": incident_id,
            "status":     "FAILED",
            "callSid":    None,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "error":      str(e),
        }), 502


# ── Health ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "EmergencyNotif_Wrapper"}), 200


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8008))
    app.run(host="0.0.0.0", port=port)