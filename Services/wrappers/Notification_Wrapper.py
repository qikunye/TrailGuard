"""
TRAILGUARD – Notification Wrapper  (External API Wrapper)
Port: 5050

Wraps Twilio SMS + Telegram Bot API. Accepts HTTP POST requests from composite
services and delivers notifications via both channels.

Bot commands (users register their phone to receive personal Telegram alerts):
  /start              – welcome message + registration instructions
  /register +65XXXXX – link phone number to this Telegram chat

Scenarios handled:
  POST /notify    – Scenario 2: emergency incident (emergency contacts + nearby hikers)
  POST /broadcast – Scenario 3: hazard broadcast to all active hikers on a trail
  GET  /health    – Liveness probe
"""

import os
import re
import json
import time
import logging
import threading
import requests as http_requests
from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv

load_dotenv("notification.env")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("NotificationWrapper")

# ── Twilio config ─────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
TWILIO_OVERRIDE_TO = os.environ.get("TWILIO_OVERRIDE_TO", "")

_missing = [k for k, v in {
    "TWILIO_ACCOUNT_SID": TWILIO_ACCOUNT_SID,
    "TWILIO_AUTH_TOKEN":  TWILIO_AUTH_TOKEN,
    "TWILIO_FROM_NUMBER": TWILIO_FROM_NUMBER,
}.items() if not v]

if _missing:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(_missing)}")

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# ── Telegram config ───────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN  = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT = os.environ.get("TELEGRAM_CHAT_ID", "")   # admin/monitor chat

# Registry persists phone → telegram chat_id mappings across restarts
REGISTRY_FILE = "/app/data/telegram_registry.json"

E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False


# ── Phone registry ────────────────────────────────────────────────────────────

def _load_registry() -> dict:
    try:
        with open(REGISTRY_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def _save_registry(registry: dict):
    os.makedirs(os.path.dirname(REGISTRY_FILE), exist_ok=True)
    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)


def register_phone(phone: str, chat_id: int, user_id: str | None = None):
    registry = _load_registry()
    registry[phone] = chat_id
    if user_id:
        registry[f"uid:{user_id}"] = chat_id
    _save_registry(registry)
    log.info("Registered phone=%s userId=%s → chat_id=%s", phone, user_id, chat_id)


def chat_id_for_phone(phone: str) -> int | None:
    return _load_registry().get(phone)


def chat_id_for_user_id(user_id) -> int | None:
    return _load_registry().get(f"uid:{user_id}")


# ── Telegram send helpers ─────────────────────────────────────────────────────

def _tg_send(chat_id, text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN:
        return False
    try:
        r = http_requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        r.raise_for_status()
        log.info("Telegram → chat_id=%s msg_id=%s", chat_id, r.json().get("result", {}).get("message_id"))
        return True
    except Exception as e:
        log.error("Telegram send to %s failed: %s", chat_id, e)
        return False


def tg_send_to_recipient(phone: str, user_id=None, text: str = "") -> bool:
    """Send a personal Telegram message, trying phone then userId lookup."""
    chat_id = chat_id_for_phone(phone) if phone else None
    if not chat_id and user_id is not None:
        chat_id = chat_id_for_user_id(user_id)
    if not chat_id:
        log.info("No Telegram registration found for phone=%s userId=%s – skipping", phone, user_id)
        return False
    return _tg_send(chat_id, text)


def tg_send_to_admin(text: str) -> bool:
    """Send a summary message to the admin/monitor chat."""
    if not TELEGRAM_ADMIN_CHAT:
        return False
    return _tg_send(TELEGRAM_ADMIN_CHAT, text)


# ── Bot command handler ───────────────────────────────────────────────────────

def _handle_bot_update(update: dict):
    msg      = update.get("message", {})
    text     = (msg.get("text") or "").strip()
    chat     = msg.get("chat", {})
    chat_id  = chat.get("id")
    username = chat.get("username") or chat.get("first_name") or "there"

    if not text or not chat_id:
        return

    if text.startswith("/start"):
        _tg_send(chat_id, (
            f"👋 Hi {username}! I'm the <b>TrailGuard</b> alert bot.\n\n"
            "To receive emergency and hazard alerts personally, link your phone number:\n\n"
            "<code>/register +6512345678</code>\n\n"
            "Use the same number registered in your TrailGuard profile."
        ))

    elif text.startswith("/register"):
        parts = text.split()
        # Formats accepted:
        #   /register +6512345678            (phone only)
        #   /register 46 +6512345678         (userId + phone)
        if len(parts) == 2 and E164_RE.match(parts[1]):
            phone, user_id = parts[1], None
        elif len(parts) == 3 and parts[1].isdigit() and E164_RE.match(parts[2]):
            user_id, phone = parts[1], parts[2]
        else:
            _tg_send(chat_id, (
                "❌ Invalid format. Use:\n\n"
                "<code>/register +6512345678</code>\n"
                "or include your TrailGuard user ID:\n"
                "<code>/register 46 +6512345678</code>\n\n"
                "Include country code (e.g. +65 for Singapore)."
            ))
            return
        register_phone(phone, chat_id, user_id)
        extra = f" and user ID <code>{user_id}</code>" if user_id else ""
        _tg_send(chat_id, (
            f"✅ <b>Registered!</b>\n\n"
            f"Phone <code>{phone}</code>{extra} is now linked to your Telegram.\n"
            "You'll receive TrailGuard emergency and hazard alerts here."
        ))


def _bot_polling_loop():
    if not TELEGRAM_BOT_TOKEN:
        return
    log.info("Telegram bot polling started")
    offset = 0
    while True:
        try:
            r = http_requests.get(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates",
                params={"offset": offset, "timeout": 30},
                timeout=35,
            )
            for update in r.json().get("result", []):
                offset = update["update_id"] + 1
                try:
                    _handle_bot_update(update)
                except Exception as e:
                    log.error("Error handling update: %s", e)
        except Exception as e:
            log.warning("Polling error: %s – retrying in 5s", e)
            time.sleep(5)


# ── Twilio SMS helpers ────────────────────────────────────────────────────────

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

# Scenario 2 – Emergency incident
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

        hiker_id   = data["hikerId"]
        hiker_name = data.get("hikerName") or f"Hiker {hiker_id}"
        address    = data.get("address") or f"{data['lat']}, {data['lng']}"
        lat        = data["lat"]
        lng        = data["lng"]
        msg_body   = data["message"]

        # ── SMS (existing behaviour) ──────────────────────────────────────────
        delivery_status = (
            _send_batch(data["emergencyContacts"], msg_body, "emergencyContact") +
            _send_batch(data["nearbyHikers"],      msg_body, "nearbyHiker")
        )

        tg_results = []

        # ── Telegram: personal message to each emergency contact ──────────────
        for contact in data["emergencyContacts"]:
            phone       = contact.get("phone", "")
            name        = contact.get("name", "there")
            sent = tg_send_to_recipient(phone, text=(
                f"🚨 <b>TrailGuard Emergency Alert</b>\n\n"
                f"Hi {name}, you are listed as an emergency contact for <b>{hiker_name}</b>.\n\n"
                f"<b>Incident:</b> {msg_body}\n\n"
                f"📍 <b>Location:</b> {address}\n\n"
                f"Please respond immediately or contact emergency services."
            ))
            tg_results.append({"to": phone, "role": "emergencyContact", "telegramStatus": "sent" if sent else "not_registered"})

        # ── Telegram: personal message to each nearby hiker ──────────────────
        for hiker in data["nearbyHikers"]:
            phone   = hiker.get("phone", "")
            user_id = hiker.get("userId")
            sent = tg_send_to_recipient(phone, user_id, text=(
                f"⚠️ <b>TrailGuard Alert — Nearby Hiker Needs Help</b>\n\n"
                f"<b>{hiker_name}</b> has reported an emergency near your location.\n\n"
                f"<b>Incident:</b> {msg_body}\n\n"
                f"📍 <b>Location:</b> {address}\n\n"
                f"If you are nearby, please assist or alert park staff."
            ))
            tg_results.append({"to": phone or str(user_id), "role": "nearbyHiker", "telegramStatus": "sent" if sent else "not_registered"})

        tg_sent = sum(1 for r in tg_results if r["telegramStatus"] == "sent")

        # ── Telegram: summary to admin chat ──────────────────────────────────
        tg_send_to_admin(
            f"🚨 <b>Emergency Alert Dispatched</b>\n\n"
            f"<b>Hiker:</b> {hiker_name}\n"
            f"<b>Location:</b> {address}\n"
            f"<b>Incident:</b> {msg_body}\n\n"
            f"<b>Emergency contacts notified:</b> {len(data['emergencyContacts'])}\n"
            f"<b>Nearby hikers notified:</b> {len(data['nearbyHikers'])}\n"
            f"<b>Reached via Telegram:</b> {tg_sent}"
        )

        return jsonify({"status": "ok", "deliveryStatus": delivery_status, "telegramStatus": tg_results}), 200

    except Exception as e:
        log.exception("Unexpected error in /notify")
        return jsonify({"status": "error", "message": str(e)}), 500


# Scenario 3 – Hazard broadcast
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

        trail_id   = data["trailId"]
        trail_name = data.get("trailName") or f"Trail #{trail_id}"
        hazard     = data["hazardType"]
        status     = data["operationalStatus"]
        severity   = data["severity"]
        user_ids   = data.get("userIds", [])

        sms_body = (
            f"TRAIL ALERT: {hazard} reported on {trail_name}. "
            f"Status: {status}. Severity: {severity}/5. "
            f"Please proceed with caution or exit the trail safely."
        )

        tg_text = (
            f"⚠️ <b>TrailGuard Hazard Alert</b>\n\n"
            f"A hazard has been reported on <b>{trail_name}</b>.\n\n"
            f"<b>Hazard:</b> {hazard}\n"
            f"<b>Trail Status:</b> {status}\n"
            f"<b>Severity:</b> {severity}/5\n\n"
            f"Please proceed with caution or exit the trail safely."
        )

        # ── SMS ───────────────────────────────────────────────────────────────
        recipients = [{"phone": p} for p in data["phones"]]
        delivery_status = _send_batch(recipients, sms_body)

        # ── Telegram: send to nearby hikers by phone or userId ────────────────
        tg_sent = 0
        notified_chats: set[int] = set()

        for phone in data["phones"]:
            chat_id = chat_id_for_phone(phone)
            if chat_id and chat_id not in notified_chats:
                if _tg_send(chat_id, tg_text):
                    notified_chats.add(chat_id)
                    tg_sent += 1

        for uid in user_ids:
            chat_id = chat_id_for_user_id(uid)
            if chat_id and chat_id not in notified_chats:
                if _tg_send(chat_id, tg_text):
                    notified_chats.add(chat_id)
                    tg_sent += 1

        # ── Telegram: summary to admin chat ──────────────────────────────────
        tg_send_to_admin(
            f"⚠️ <b>Hazard Broadcast Sent</b>\n\n"
            f"<b>Trail:</b> {trail_name}\n"
            f"<b>Hazard:</b> {hazard}\n"
            f"<b>Status:</b> {status}\n"
            f"<b>Severity:</b> {severity}/5\n"
            f"<b>Active hikers on trail:</b> {len(user_ids)}\n"
            f"<b>Reached via Telegram:</b> {tg_sent}"
        )

        return jsonify({"status": "ok", "deliveryStatus": delivery_status, "telegramSent": tg_sent}), 200

    except Exception as e:
        log.exception("Unexpected error in /broadcast")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    registry_count = len(_load_registry())
    return jsonify({
        "service":           "notification-wrapper",
        "status":            "healthy",
        "telegram_enabled":  bool(TELEGRAM_BOT_TOKEN),
        "registered_phones": registry_count,
    }), 200


# ── Start Telegram bot polling thread ─────────────────────────────────────────
if TELEGRAM_BOT_TOKEN:
    threading.Thread(target=_bot_polling_loop, daemon=True).start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
