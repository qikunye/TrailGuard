"""
TRAILGUARD – Notification Wrapper  (External API Wrapper)
Port: 5050

Wraps the Telegram Bot API. Accepts HTTP POST requests from composite
services and delivers notifications via Telegram.

Bot commands:
  /start <userId>_<phoneDigits> – auto-registration via deep link (profile page button)
  /start                        – welcome message with manual instructions
  /register <userId> +65XXXXX   – manually link phone + userId to this Telegram chat

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
import pika
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv("notification.env")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("NotificationWrapper")

# ── Telegram config ───────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN  = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT = os.environ.get("TELEGRAM_CHAT_ID", "")
RABBITMQ_URL        = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

HAZARD_QUEUE    = "hazard_notifications"
INCIDENT_QUEUE  = "incident_notifications"

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


def _normalize_phone(phone: str) -> list[str]:
    """Return possible registry keys for a phone number to handle format mismatches."""
    candidates = [phone]
    digits = phone.lstrip("+")
    if not digits.startswith("65") and len(digits) == 8:
        candidates.append(f"+65{digits}")
    if digits.startswith("65") and len(digits) > 8:
        candidates.append(f"+{digits}")
        candidates.append(f"+{digits[2:]}")
    return candidates


def chat_id_for_phone(phone: str) -> int | None:
    registry = _load_registry()
    for candidate in _normalize_phone(phone):
        if candidate in registry:
            return registry[candidate]
    return None


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
        parts = text.split()
        # Deep-link auto-registration: /start <userId>_<phoneDigits>
        if len(parts) == 2 and "_" in parts[1]:
            uid_part, phone_digits = parts[1].split("_", 1)
            if uid_part.isdigit() and phone_digits.isdigit():
                phone = f"+{phone_digits}"
                if E164_RE.match(phone):
                    register_phone(phone, chat_id, uid_part)
                    _tg_send(chat_id, (
                        f"✅ <b>Connected, {username}!</b>\n\n"
                        f"Your TrailGuard account (User #{uid_part}) and phone <code>{phone}</code> "
                        "are now linked.\n\n"
                        "You'll receive trail hazard and emergency alerts here automatically."
                    ))
                    return
        # Default welcome
        _tg_send(chat_id, (
            f"👋 Hi {username}! I'm the <b>TrailGuard</b> alert bot.\n\n"
            "To connect your account, use the <b>Connect Telegram</b> button on your TrailGuard profile page — "
            "it links everything automatically in one tap.\n\n"
            "Or register manually:\n"
            "<code>/register YOUR_USER_ID +6512345678</code>"
        ))

    elif text.startswith("/register"):
        parts = text.split()
        if len(parts) == 2 and E164_RE.match(parts[1]):
            phone, user_id = parts[1], None
        elif len(parts) == 3 and parts[1].isdigit() and E164_RE.match(parts[2]):
            user_id, phone = parts[1], parts[2]
        else:
            _tg_send(chat_id, (
                "❌ Invalid format. Use:\n\n"
                "<code>/register YOUR_USER_ID +6512345678</code>\n\n"
                "Example: <code>/register 46 +6591234567</code>\n\n"
                "Find your User ID on your TrailGuard profile page. "
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
        msg_body   = data["message"]
        silent     = data.get("silent", False)

        tg_results = []

        # ── Telegram: hiker self-confirmation (silent calls only) ─────────────
        hiker_phone = data.get("hikerPhone")
        hiker_msg   = data.get("hikerMessage")
        if silent and hiker_phone and hiker_msg:
            tg_send_to_recipient(hiker_phone, text=(
                f"✅ <b>Emergency Report Received</b>\n\n"
                f"{hiker_msg}\n\n"
                f"📍 <b>Location:</b> {address}\n\n"
                f"Stay where you are and keep your phone visible."
            ))
            return jsonify({"status": "ok", "telegramStatus": []}), 200

        # ── Telegram: emergency contacts ──────────────────────────────────────
        for contact in data["emergencyContacts"]:
            phone = contact.get("phone", "")
            name  = contact.get("name", "there")
            sent  = tg_send_to_recipient(phone, text=(
                f"🚨 <b>TrailGuard Emergency Alert</b>\n\n"
                f"Hi {name}, you are listed as an emergency contact for <b>{hiker_name}</b>.\n\n"
                f"<b>Incident:</b> {msg_body}\n\n"
                f"📍 <b>Location:</b> {address}\n\n"
                f"Please respond immediately or contact emergency services."
            ))
            tg_results.append({"to": phone, "role": "emergencyContact", "telegramStatus": "sent" if sent else "not_registered"})

        # ── Telegram: nearby hikers ───────────────────────────────────────────
        for hiker in data["nearbyHikers"]:
            phone   = hiker.get("phone", "")
            user_id = hiker.get("userId")
            sent    = tg_send_to_recipient(phone, user_id, text=(
                f"⚠️ <b>TrailGuard Alert — Nearby Hiker Needs Help</b>\n\n"
                f"<b>{hiker_name}</b> has reported an emergency near your location.\n\n"
                f"<b>Incident:</b> {msg_body}\n\n"
                f"📍 <b>Location:</b> {address}\n\n"
                f"If you are nearby, please assist or alert park staff."
            ))
            tg_results.append({"to": phone or str(user_id), "role": "nearbyHiker", "telegramStatus": "sent" if sent else "not_registered"})

        tg_sent = sum(1 for r in tg_results if r["telegramStatus"] == "sent")

        if not silent:
            tg_send_to_admin(
                f"🚨 <b>Emergency Alert Dispatched</b>\n\n"
                f"<b>Hiker:</b> {hiker_name}\n"
                f"<b>Location:</b> {address}\n"
                f"<b>Incident:</b> {msg_body}\n\n"
                f"<b>Emergency contacts notified:</b> {len(data['emergencyContacts'])}\n"
                f"<b>Nearby hikers notified:</b> {len(data['nearbyHikers'])}\n"
                f"<b>Reached via Telegram:</b> {tg_sent}"
            )

        return jsonify({"status": "ok", "telegramStatus": tg_results}), 200

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

        tg_text = (
            f"⚠️ <b>TrailGuard Hazard Alert</b>\n\n"
            f"A hazard has been reported on <b>{trail_name}</b>.\n\n"
            f"<b>Hazard:</b> {hazard}\n"
            f"<b>Trail Status:</b> {status}\n"
            f"<b>Severity:</b> {severity}/5\n\n"
            f"Please proceed with caution or exit the trail safely."
        )

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

        # Always send to the admin chat as a fallback so at least one recipient
        # is guaranteed regardless of who is registered in the Telegram registry.
        if TELEGRAM_ADMIN_CHAT:
            try:
                admin_chat_id = int(TELEGRAM_ADMIN_CHAT)
                if admin_chat_id not in notified_chats:
                    if _tg_send(admin_chat_id, tg_text):
                        notified_chats.add(admin_chat_id)
                        tg_sent += 1
            except (ValueError, TypeError):
                log.warning("TELEGRAM_CHAT_ID is not a valid integer: %s", TELEGRAM_ADMIN_CHAT)

        return jsonify({"status": "ok", "telegramSent": tg_sent}), 200

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


# ── RabbitMQ consumer helpers ─────────────────────────────────────────────────

def _dispatch_hazard(data: dict):
    """Process a hazard_notifications message (same logic as /broadcast)."""
    trail_id   = data.get("trailId", "?")
    trail_name = data.get("trailName") or f"Trail #{trail_id}"
    hazard     = data.get("hazardType", "Unknown")
    status     = data.get("operationalStatus", "CAUTION")
    severity   = data.get("severity", 3)
    user_ids   = data.get("userIds", [])
    phones     = data.get("phones", [])

    tg_text = (
        f"⚠️ <b>TrailGuard Hazard Alert</b>\n\n"
        f"A hazard has been reported on <b>{trail_name}</b>.\n\n"
        f"<b>Hazard:</b> {hazard}\n"
        f"<b>Trail Status:</b> {status}\n"
        f"<b>Severity:</b> {severity}/5\n\n"
        f"Please proceed with caution or exit the trail safely."
    )

    tg_sent = 0
    notified_chats: set = set()

    for phone in phones:
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

    if TELEGRAM_ADMIN_CHAT:
        try:
            admin_chat_id = int(TELEGRAM_ADMIN_CHAT)
            if admin_chat_id not in notified_chats:
                if _tg_send(admin_chat_id, tg_text):
                    notified_chats.add(admin_chat_id)
                    tg_sent += 1
        except (ValueError, TypeError):
            pass

    log.info("RabbitMQ hazard dispatch ✓ sent=%d trailId=%s", tg_sent, trail_id)


def _dispatch_incident(data: dict):
    """Process an incident_notifications message (same logic as /notify)."""
    hiker_id   = data.get("hikerId", "?")
    hiker_name = data.get("hikerName") or f"Hiker {hiker_id}"
    address    = data.get("address", "Unknown location")
    msg_body   = data.get("message", "Emergency reported.")
    tg_results = []

    for contact in data.get("emergencyContacts", []):
        phone = contact.get("phone", "")
        name  = contact.get("name", "there")
        sent  = tg_send_to_recipient(phone, text=(
            f"🚨 <b>TrailGuard Emergency Alert</b>\n\n"
            f"Hi {name}, you are listed as an emergency contact for <b>{hiker_name}</b>.\n\n"
            f"<b>Incident:</b> {msg_body}\n\n"
            f"📍 <b>Location:</b> {address}\n\n"
            f"Please respond immediately or contact emergency services."
        ))
        tg_results.append({"to": phone, "role": "emergencyContact", "sent": sent})

    for hiker in data.get("nearbyHikers", []):
        phone   = hiker.get("phone", "")
        user_id = hiker.get("userId")
        sent    = tg_send_to_recipient(phone, user_id, text=(
            f"⚠️ <b>TrailGuard Alert — Nearby Hiker Needs Help</b>\n\n"
            f"<b>{hiker_name}</b> has reported an emergency near your location.\n\n"
            f"<b>Incident:</b> {msg_body}\n\n"
            f"📍 <b>Location:</b> {address}\n\n"
            f"If you are nearby, please assist or alert park staff."
        ))
        tg_results.append({"to": phone or str(user_id), "role": "nearbyHiker", "sent": sent})

    tg_send_to_admin(
        f"🚨 <b>Emergency Alert Dispatched</b>\n\n"
        f"<b>Hiker:</b> {hiker_name}\n"
        f"<b>Location:</b> {address}\n"
        f"<b>Incident:</b> {msg_body}\n\n"
        f"<b>Emergency contacts notified:</b> {len(data.get('emergencyContacts', []))}\n"
        f"<b>Nearby hikers notified:</b> {len(data.get('nearbyHikers', []))}"
    )

    tg_sent = sum(1 for r in tg_results if r["sent"])
    log.info("RabbitMQ incident dispatch ✓ sent=%d hikerId=%s", tg_sent, hiker_id)


def _on_message(channel, method, properties, body, queue_name: str):
    try:
        data = json.loads(body)
        log.info("RabbitMQ message received | queue=%s", queue_name)
        if queue_name == HAZARD_QUEUE:
            _dispatch_hazard(data)
        elif queue_name == INCIDENT_QUEUE:
            _dispatch_incident(data)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        log.error("RabbitMQ message processing error (queue=%s): %s", queue_name, e)
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def _rabbitmq_consumer_loop():
    """Daemon thread: consume from hazard and incident queues with reconnect loop."""
    while True:
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            params.socket_timeout = 10
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.basic_qos(prefetch_count=1)

            for queue in (HAZARD_QUEUE, INCIDENT_QUEUE):
                channel.queue_declare(queue=queue, durable=True)
                channel.basic_consume(
                    queue=queue,
                    on_message_callback=lambda ch, m, p, b, q=queue: _on_message(ch, m, p, b, q),
                )

            log.info("RabbitMQ consumer started — listening on %s, %s", HAZARD_QUEUE, INCIDENT_QUEUE)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as e:
            log.warning("RabbitMQ connection lost: %s — retrying in 10s", e)
            time.sleep(10)
        except Exception as e:
            log.error("RabbitMQ consumer error: %s — retrying in 10s", e)
            time.sleep(10)


# ── Start Telegram bot polling thread ─────────────────────────────────────────
if TELEGRAM_BOT_TOKEN:
    threading.Thread(target=_bot_polling_loop, daemon=True).start()

# ── Start RabbitMQ consumer thread ────────────────────────────────────────────
threading.Thread(target=_rabbitmq_consumer_loop, daemon=True).start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
