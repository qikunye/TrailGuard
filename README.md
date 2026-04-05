# TrailGuard

A trail safety and hiking management platform built for Singapore's hiking community. TrailGuard helps hikers assess trail safety before heading out, track hikes in real time, respond to on-trail emergencies, and report hazards — backed by a microservices architecture.

---

## Features

- **AI Trail Safety Assessment** — Pre-hike GO / CAUTION / DO NOT GO verdict powered by GPT-4o-mini, combining live weather, trail conditions, hiker fitness, and historical incident data
- **Live Hike Tracking** — Real-time GPS breadcrumb trail with planned route overlay, elapsed time, distance, and pace stats
- **Emergency Response** — One-tap emergency reporting that notifies emergency contacts and nearby hikers via Telegram; incident persisted to Firestore for trail-wide visibility
- **Hazard Reporting & Rerouting** — Report trail hazards to update trail status and receive an OSRM-computed alternative route
- **Trail Dashboard (GraphQL)** — Single GraphQL query aggregates trail conditions, active hazards (with description, location, date), and recent incidents in one round trip
- **Telegram Notifications** — Deep-link bot registration; real-time Telegram push alerts for hazards and emergencies
- **Monitoring** — Kong API gateway with per-route key auth, rate limiting, and Konga admin UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Tailwind CSS 4, Vite 5, Leaflet |
| Backend | Python 3.11, FastAPI |
| API types | REST (primary) + GraphQL via Strawberry (trail dashboard) |
| Auth & DB | Firebase Auth, Firebase Firestore |
| External data | OutSystems (hiker profiles, trail data, hike progress) |
| AI | OpenAI GPT-4o-mini |
| Notifications | Telegram Bot API |
| Message broker | RabbitMQ 3.13 (async notification delivery) |
| Maps & routing | Google Maps Platform, OSRM |
| Weather | Open-Meteo (free, no key required) |
| Gateway | Kong 3.6 (DB-less, key-auth plugin) |
| Admin UI | Konga |
| Infrastructure | Docker, Docker Compose |

---

## Architecture

All client traffic flows through the **Kong API Gateway** on port `8080`. The frontend never talks directly to any backend service.

```
Browser (React :5173)
        │  X-API-Key header on every request
        ▼
Kong API Gateway (:8080)
        │  strips key, strips /api/<prefix>, forwards to upstream
        │
        ├── Composite / Orchestrator Services
        │     ├── Trail Safety Assessment   :8000   (Scenario 1)
        │     ├── Incident Reporting        :8008   (Scenario 2)
        │     ├── Report Ingestion          :8010   (Scenario 3)
        │     └── Alternative Route         :8009   (Scenario 3)
        │
        ├── Atomic Services
        │     ├── Hiker Profile             :8001  → OutSystems
        │     ├── Trail Condition           :8002  → OutSystems + Trail Hazards DB
        │     ├── Trail Query (GraphQL)     :8011  → aggregates trail-condition + incidents
        │     ├── Incident Risk             :8003  → OutSystems
        │     ├── Hike Completion           :8004
        │     ├── Trail Incident            :5004  → Firestore
        │     ├── Emergency Contacts        :5003  → OutSystems
        │     ├── Nearby Users              :5005  → OutSystems
        │     └── Completed User Hike       :5006  → OutSystems
        │
        │
        └── Wrappers (external API adapters)
              ├── Weather                   :8005  → Open-Meteo
              ├── Evaluator                 :8006  → OpenAI GPT-4o-mini
              ├── Google Maps               :8007  → Google Maps Platform
              └── Notification              :5050  → Telegram Bot API

RabbitMQ Message Broker (:5672)
        │
        ├── hazard_notifications    ← published by Report Ingestion (Scenario 3)
        └── incident_notifications  ← published by Incident Reporting (Scenario 2)
                │
                └── consumed by Notification Wrapper → Telegram dispatch
```

---

## The Three Scenarios

### Scenario 1 — Pre-Hike Safety Assessment

1. Hiker selects a trail and a planned start time on the **Trail Assessment** page
2. Orchestrator fires concurrent requests to fetch hiker fitness profile, live weather forecast, trail conditions, and 30/90-day incident counts
3. Estimated hike completion time is calculated from fitness level, trail difficulty, and weather conditions
4. All data is sent to OpenAI — returns a **GO / CAUTION / DO NOT GO** verdict with a reasoning paragraph and confidence score
5. Hiker sees the verdict before proceeding to register the hike

### Scenario 2 — On-Trail Emergency Response

1. Hiker taps "Report Emergency" on the **Track Hike** page and selects injury type and severity (1–5)
2. GPS coordinates are reverse-geocoded to a human-readable address via Google Maps
3. Emergency contacts are fetched from OutSystems
4. Nearby active hikers on the same trail are fetched from OutSystems (isHiking = true)
5. Alert payload is published to the `incident_notifications` RabbitMQ queue; Notification Wrapper consumes it and dispatches Telegram messages to emergency contacts and nearby hikers
6. Incident is persisted to Firestore — visible to all hikers on the same trail via the trail dashboard within 24 hours

### Scenario 3 — Hazard Reporting & Rerouting

1. Hiker reports a hazard (type, GPS location, description) on the **Hazard Report** page
2. Hazard is persisted to the Trail Hazards DB via Trail Condition Service (`POST /CreateReport`)
3. Alert payload is published to the `hazard_notifications` RabbitMQ queue; Notification Wrapper consumes it and dispatches Telegram broadcasts to all registered hikers on the trail
4. Trail operational status is updated to **CAUTION**
5. OSRM finds candidate alternative walking routes; the route with the greatest deviation from the hazard point is selected
6. Frontend displays the original and alternative routes on a map with distance and ETA

---

## GraphQL — Trail Dashboard

The Track Hike page uses a **GraphQL** query (via the Trail Query Service) to replace three separate REST calls with a single round trip.

**Endpoint:** `POST /api/trail-query/graphql`

**What it aggregates (3 concurrent fetches via `asyncio.gather`):**

| Source | Data |
|---|---|
| `trail-condition:8002/trail/{id}/conditions` | Trail name, status, difficulty, hazard details, distance, estimated duration, recommended pace |
| `incident-service:5004/incidents/trail/{id}` | Recent incidents from Firestore, filtered to last 24 hours |
| `trail-condition:8002/hazards/trail/{id}` | Active user-reported hazards from Trail Hazards DB, filtered to last 24 hours |

**Schema (query):**
```graphql
query TrailDashboard($trailId: String!) {
  trailDashboard(trailId: $trailId) {
    trailId
    name
    operationalStatus
    difficulty
    activeHazards
    distanceKm
    estimatedDurationMins
    recommendedPaceMinsPerKm
    hazardDetails { type severity location description reportedAt }
    isClosed
    lastUpdated
    recentIncidents {
      incidentId injuryType severity description reportedAt
      location { lat lng }
    }
  }
}
```

The GraphiQL playground is available at `http://localhost:8011/graphql` (direct, bypasses Kong — no API key needed).

---

## RabbitMQ — Async Notification Delivery

Notifications are decoupled from the main request flow using RabbitMQ as a message broker. This means hazard reports and incident alerts return a response to the hiker immediately without waiting for Telegram delivery to complete.

**Queues:**

| Queue | Published by | Consumed by |
|---|---|---|
| `hazard_notifications` | Report Ingestion Service | Notification Wrapper |
| `incident_notifications` | Incident Reporting Service | Notification Wrapper |

**Flow:**
1. Orchestrator publishes a JSON payload to the appropriate queue (non-blocking, via thread executor)
2. `Notification_Wrapper` runs a persistent daemon consumer thread that picks up messages and dispatches Telegram alerts
3. Messages are **durable and persistent** — if the Notification Wrapper restarts, queued messages are not lost and will be processed when it comes back up
4. If RabbitMQ is unreachable, orchestrators automatically **fall back to direct HTTP** (`/broadcast` or `/notify`) so the notification flow never breaks

**Management UI:** `http://localhost:15672` — login `guest` / `guest`

---

## Project Structure

```
TrailGuard/
├── .env                             # Master env file — gitignored (see below)
├── docker-compose.yml
├── kong/
│   └── kong.yml                     # Kong declarative config (DB-less)
├── Frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/                   # One file per page/route
│       │   ├── LandingPage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── TrailAssessmentPage.jsx
│       │   ├── AssessmentResultPage.jsx
│       │   ├── TrailRegistrationPage.jsx
│       │   ├── TrackHikePage.jsx    # GraphQL trail dashboard + live GPS tracking
│       │   ├── EmergencyReportPage.jsx
│       │   ├── EmergencyConfirmPage.jsx
│       │   ├── HazardReportPage.jsx
│       │   ├── AlternativeRoutePage.jsx
│       │   ├── ProfilePage.jsx
│       │   └── TelegramSetupPage.jsx
│       ├── components/              # Shared + feature-specific UI components
│       ├── services/                # API call helpers (kongFetch wrappers)
│       ├── hooks/                   # useAuth, useProfile
│       ├── lib/                     # kongClient.js, Google Maps loader
│       └── firebase/                # Firebase SDK initialisation
└── Services/
    ├── orchestrator/                # Composite services (multi-step flows)
    │   ├── Trail_Safety_Assessment_Service.py
    │   ├── Incident_Reporting_Service.py
    │   ├── Report_Ingestion_Service.py
    │   └── Alternative_Route_Service.py
    ├── atomic/                      # Single-responsibility services
    │   ├── Hiker_Profile_Service.py
    │   ├── Trail_Condition_Service.py
    │   ├── Trail_Query_Service.py   # GraphQL (Strawberry)
    │   ├── Trail_Incident.py        # Firestore incidents
    │   ├── Incident_Risk_Service.py
    │   ├── Hike_Completion_Service.py
    │   ├── Emergency_Contacts_Service.py
    │   ├── Nearby_Users_Service.py
    │   └── Completed_User_Hike_Service.py
    └── wrappers/                    # Thin adapters to external APIs
        ├── Weather_Wrapper.py
        ├── Evaluator_Wrapper.py
        └── GoogleMaps_Wrapper.py
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose

### 1. Create the environment file

Create `.env` in the project root (never committed — listed in `.gitignore`). All backend services and the frontend Docker build read from this single file.

```env
# ── Frontend (baked into Vite bundle at Docker build time) ──────────────────
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GOOGLE_MAPS_API_KEY=
VITE_MAPS_WRAPPER_URL=http://localhost:8080/api/maps
VITE_KONG_BASE_URL=http://localhost:8080
VITE_KONG_API_KEY=tg-dev-key-local-only
VITE_TRAIL_QUERY_URL=http://localhost:8080/api/trail-query

# ── Backend services ─────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
OUTSYSTEMS_BASE_URL=
NEARBY_USERS_API_URL=
HIKE_PROGRESS_API_URL=
OUTSYSTEMS_TRAIL_CONDITION_URL=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

> **Firebase service account:** paste your service account JSON as a single minified line for `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 2. Start everything

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| Kong gateway | http://localhost:8080 |
| Konga (Kong UI) | http://localhost:1337 |
| GraphiQL playground | http://localhost:8011/graphql |
| RabbitMQ management UI | http://localhost:15672 (guest / guest) |

### 3. Local frontend development (optional)

Run the backend stack in Docker and start Vite separately for hot-reload:

```bash
# Terminal 1 — all backend services
docker compose up

# Terminal 2 — Vite dev server with hot reload
cd Frontend
cp ../.env .env        # copy root env so Vite picks up VITE_* vars
npm install
npm run dev
```

---

## Kong API Routes

All routes require an `X-API-Key` header. The development key is `tg-dev-key-local-only`.

| Path prefix | Upstream service | Port | Rate limit |
|---|---|---|---|
| `/api/orchestrator` | Trail Safety Assessment | 8000 | 30 req/min |
| `/api/incident` | Incident Reporting | 8008 | 100 req/min |
| `/api/hazard-report` | Report Ingestion | 8010 | 100 req/min |
| `/api/alt-route` | Alternative Route | 8009 | 100 req/min |
| `/api/trail-query` | Trail Query (GraphQL) | 8011 | 100 req/min |
| `/api/hiker` | Hiker Profile | 8001 | 100 req/min |
| `/api/trail` | Trail Condition | 8002 | 100 req/min |
| `/api/risk` | Incident Risk | 8003 | 100 req/min |
| `/api/completion` | Hike Completion | 8004 | 100 req/min |
| `/api/weather` | Weather Wrapper | 8005 | 100 req/min |
| `/api/evaluator` | Evaluator (OpenAI) | 8006 | 10 req/min |
| `/api/maps` | Google Maps Wrapper | 8007 | 100 req/min |
| `/api/notify` | Notification Wrapper | 5050 | 20 req/min |
| `/api/emergency` | Emergency Contacts | 5003 | 100 req/min |
| `/api/incidents-svc` | Trail Incident (Firestore) | 5004 | 100 req/min |
| `/api/nearby` | Nearby Users | 5005 | 100 req/min |
| `/api/completed` | Completed User Hike | 5006 | 100 req/min |

Kong strips the `/api/<prefix>` before forwarding to the upstream (all routes use `strip_path: true`).

---

## Telegram Setup

1. Open your TrailGuard profile → **Connect Telegram**
2. This opens a deep link to `@trail_guardbot` with your user ID and phone pre-filled
3. Tap **Start** in Telegram — the bot auto-registers your account in one tap
4. You will now receive hazard broadcasts and emergency alerts directly in Telegram

Manual registration is also supported: send `/register <userId> +65XXXXXXXX` in the bot chat.

---

## Monitoring

- **Konga** at `http://localhost:1337` — visual Kong admin UI for inspecting routes, consumers, plugins, and logs; connect to `http://kong:8001` on first login
- **Kong access logs** are written to `/tmp/kong-access.log` inside the Kong container
- **RabbitMQ Management UI** at `http://localhost:15672` (guest / guest) — inspect queues (`hazard_notifications`, `incident_notifications`), message rates, and consumer connections in real time
