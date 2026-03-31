"""
TRAILGUARD – Notification Wrapper  (External API Wrapper)
Port: 5050

Wraps the Twilio SMS API. Accepts HTTP POST requests from composite services
and translates them into Twilio API calls.

Scenarios handled:
  POST /notify    – Scenario 2: emergency incident (emergency contacts + nearby hikers)
  POST /broadcast – Scenario 3: hazard broadcast to all active hikers on a trail
  GET  /health    – Liveness probe
"""

import os
import re
import logging
from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv

load_dotenv("notification.env")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("NotificationWrapper")

# ── Validate required env vars at startup ─────────────────────────────────────
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")

_missing = [k for k, v in {
    "TWILIO_ACCOUNT_SID": TWILIO_ACCOUNT_SID,
    "TWILIO_AUTH_TOKEN":  TWILIO_AUTH_TOKEN,
    "TWILIO_FROM_NUMBER": TWILIO_FROM_NUMBER,
}.items() if not v]

if _missing:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing)}")

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")

# Twilio trial accounts can only send to verified numbers.
# Set this to your verified number so all SMS are routed there for testing.
TWILIO_OVERRIDE_TO = os.environ.get("TWILIO_OVERRIDE_TO", "")


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_valid_e164(phone: str) -> bool:
    return bool(E164_RE.match(phone or ""))


def send_sms(to: str, body: str) -> str:
    actual_to = TWILIO_OVERRIDE_TO if TWILIO_OVERRIDE_TO else to
    msg = twilio_client.messages.create(body=body, from_=TWILIO_FROM_NUMBER, to=actual_to)
    return msg.status


def _send_batch(recipients: list[dict], body: str, recipient_type: str | None = None) -> list[dict]:
    results = []
    for r in recipients:
        phone = r.get("phone", "")
        entry = {"to": phone}
        if recipient_type:
            entry["recipientType"] = recipient_type

        # If an override number is set, skip E.164 validation on the original
        # number — the override number will be used for actual delivery.
        if not TWILIO_OVERRIDE_TO and not is_valid_e164(phone):
            log.warning("Invalid E.164 number skipped: %s", phone)
            entry["twilioStatus"] = "failed"
            results.append(entry)
            continue

        if not phone:
            log.warning("Empty phone number skipped")
            entry["twilioStatus"] = "failed"
            results.append(entry)
            continue

        try:
            entry["twilioStatus"] = send_sms(phone, body)
            if TWILIO_OVERRIDE_TO:
                log.info("SMS for %s routed to override number %s", phone, TWILIO_OVERRIDE_TO)
        except TwilioRestException as e:
            log.error("Twilio error for %s: %s", phone, e)
            entry["twilioStatus"] = "failed"

        results.append(entry)
    return results


# ── Endpoints ─────────────────────────────────────────────────────────────────

# Scenario 2 – Emergency incident reporting
# Called by the Incident Reporting composite service to notify a hiker's
# emergency contacts and nearby hikers via SMS.
@app.route("/notify", methods=["POST"])
def notify():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"status": "error", "message": "Request body must be valid JSON"}), 400

        required = ["hikerId", "lat", "lng", "emergencyContacts", "nearbyHikers", "message"]
        missing  = [f for f in required if f not in data]
        if missing:
            return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing)}"}), 400

        msg_body = data["message"]
        delivery_status = (
            _send_batch(data["emergencyContacts"], msg_body, "emergencyContact") +
            _send_batch(data["nearbyHikers"],      msg_body, "nearbyHiker")
        )

        return jsonify({"status": "ok", "deliveryStatus": delivery_status}), 200

    except Exception as e:
        log.exception("Unexpected error in /notify")
        return jsonify({"status": "error", "message": str(e)}), 500


# Scenario 3 – Hazard broadcast to all active hikers on a trail
# Called by the Trail Condition composite service to mass-notify hikers
# currently on an affected trail.
@app.route("/broadcast", methods=["POST"])
def broadcast():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"status": "error", "message": "Request body must be valid JSON"}), 400

        required = ["userIds", "phones", "trailId", "operationalStatus", "hazardType", "severity"]
        missing  = [f for f in required if f not in data]
        if missing:
            return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing)}"}), 400

        msg_body = (
            f"TRAIL ALERT: {data['hazardType']} reported on trail {data['trailId']}. "
            f"Status: {data['operationalStatus']}. Severity: {data['severity']}/5. "
            f"Please proceed with caution or exit the trail safely."
        )

        recipients = [{"phone": p} for p in data["phones"]]
        delivery_status = _send_batch(recipients, msg_body)

        return jsonify({"status": "ok", "deliveryStatus": delivery_status}), 200

    except Exception as e:
        log.exception("Unexpected error in /broadcast")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"service": "notification-wrapper", "status": "healthy"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
