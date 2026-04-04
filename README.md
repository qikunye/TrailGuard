# TrailGuard

A trail safety and hiking management platform for Singapore's hiking community. TrailGuard helps hikers assess trail conditions before heading out, track hikes in real time, respond to on-trail emergencies, and report hazards — all backed by a microservices architecture.

---

## Features

- **AI Trail Safety Assessment** — Pre-hike GO / CAUTION / DO NOT GO verdict powered by GPT-4o-mini, using live weather, trail conditions, and historical incidents
- **Live Hike Tracking** — GPS breadcrumb trail with planned route overlay on an interactive map
- **Emergency Response** — One-tap emergency reporting that notifies emergency contacts and nearby hikers via Telegram
- **Hazard Reporting** — Report trail hazards, auto-update trail status, and receive alternative route suggestions
- **Telegram Notifications** — Deep-link bot registration; real-time push alerts for hazards and emergencies
- **Monitoring** — Kong API gateway with rate limiting, Prometheus metrics, and Grafana dashboards

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Tailwind CSS 4, Vite 5, Leaflet |
| Backend | Python 3, FastAPI, Flask |
| Auth & DB | Firebase Auth, Firebase Firestore |
| External data | OutSystems (hiker profiles, trail data, hike progress) |
| AI | OpenAI GPT-4o-mini |
| Notifications | Telegram Bot API |
| Maps & routing | Google Maps Platform, OSRM (open-source routing) |
| Weather | Open-Meteo (free, no key required) |
| Gateway | Kong 3.6 (DB-less) |
| Monitoring | Prometheus, Grafana |
| Infrastructure | Docker, Docker Compose |

---

## Architecture

All client traffic flows through the Kong API gateway on port `8080`. The frontend talks only to Kong, which routes requests to the appropriate microservice.

```
Frontend (React :5173)
        │
        ▼
Kong API Gateway (:8080)
        │
        ├── Orchestrators (composite services)
        │     ├── Trail Safety Assessment  :8000
        │     ├── Incident Reporting       :8008
        │     ├── Report Ingestion         :8010
        │     └── Alternative Route        :8009
        │
        ├── Atomic Services
        │     ├── Hiker Profile            :8001  → OutSystems
        │     ├── Trail Condition          :8002  → OutSystems
        │     ├── Incident Risk            :8003  → OutSystems
        │     ├── Hike Completion          :8004
        │     ├── Trail Incident           :5004  → Firestore
        │     ├── Emergency Contacts       :5003  → OutSystems
        │     ├── Nearby Users             :5005  → OutSystems
        │     └── Completed User Hike      :5006  → OutSystems
        │
        └── Wrappers (external API adapters)
              ├── Weather                  :8005  → Open-Meteo
              ├── Evaluator                :8006  → OpenAI
              ├── Google Maps              :8007  → Google Maps Platform
              └── Notification             :5050  → Telegram Bot API
```

---

## The Three Scenarios

### Scenario 1 — Pre-Hike Safety Assessment

1. Hiker selects a trail and planned start time
2. Orchestrator concurrently fetches hiker profile, live weather, trail conditions, and 30/90-day incident counts
3. Hike completion time is estimated based on fitness, weather, and trail difficulty
4. Consolidated data is sent to OpenAI — returns **GO / CAUTION / DO NOT GO** with reasoning and confidence score
5. Hiker sees the verdict before registering the hike

### Scenario 2 — On-Trail Emergency Response

1. Hiker taps "Report Emergency", selects injury type and severity
2. GPS coordinates are reverse-geocoded to a human-readable address (Google Maps)
3. Emergency contacts are fetched from OutSystems
4. Nearby active hikers on the same trail are fetched from OutSystems
5. Telegram alerts sent to emergency contacts and nearby hikers in a single notify call
6. Incident persisted to Firestore for cross-user visibility (visible to all hikers on the same trail within 24 hours)

### Scenario 3 — Hazard Reporting & Rerouting

1. Hiker reports a hazard with type, severity (1–5), and GPS location
2. All currently active hikers on the trail receive a Telegram broadcast
3. Trail condition status is updated based on severity:
   - Severity 4–5 → **CLOSED**
   - Severity 2–3 → **CAUTION**
   - Severity 1 → unchanged
4. OSRM is queried for alternative walking routes; the route farthest from the hazard is selected
5. Frontend displays the original and alternative routes on a map with distance and ETA comparison

---

## Project Structure

```
TrailGuard/
├── .env                        # Master env file — not committed (see .gitignore)
├── docker-compose.yml
├── kong/
│   └── kong.yml                # Kong declarative config (DB-less)
├── Frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/              # React page components
│       ├── components/         # Shared + feature-specific components
│       ├── services/           # API call helpers
│       ├── hooks/              # useAuth, useProfile, etc.
│       ├── lib/                # kongClient, googleMaps loader
│       └── firebase/           # Firebase SDK init
└── Services/
    ├── orchestrator/           # Composite services (multi-step flows)
    ├── atomic/                 # Single-responsibility services
    └── wrappers/               # External API adapters
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (only needed for local frontend dev without Docker)

### 1. Set up environment variables

Create a `.env` file in the project root:

```env
# Frontend — baked into Vite build at Docker build time
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

# Backend services
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

### 2. Run with Docker Compose

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| Kong gateway | http://localhost:8080 |
| Konga (Kong UI) | http://localhost:1337 |
| Grafana | http://localhost:13000 |
| Prometheus | http://localhost:9090 |

### 3. Local frontend development (optional)

If you want Vite's hot-reload during frontend development, run the backend via Docker and start Vite separately:

```bash
# Terminal 1 — backend only
docker compose up

# Terminal 2 — frontend with hot reload
cd Frontend
npm install
npm run dev
```

---

## Kong API Routes

All routes require an `X-API-Key` header. The development key is `tg-dev-key-local-only`.

| Path prefix | Service | Rate limit |
|---|---|---|
| `/api/orchestrator` | Trail Safety Assessment | 30 req/min |
| `/api/incident` | Incident Reporting | — |
| `/api/hazard-report` | Report Ingestion | — |
| `/api/alt-route` | Alternative Route | — |
| `/api/hiker` | Hiker Profile | — |
| `/api/trail` | Trail Condition | — |
| `/api/risk` | Incident Risk | — |
| `/api/completion` | Hike Completion | — |
| `/api/weather` | Weather Wrapper | — |
| `/api/evaluator` | Evaluator (OpenAI) | 10 req/min |
| `/api/maps` | Google Maps Wrapper | — |
| `/api/notify` | Notification Wrapper | 20 req/min |
| `/api/emergency` | Emergency Contacts | — |
| `/api/nearby` | Nearby Users | — |
| `/api/completed` | Completed User Hike | — |

---

## Telegram Setup

1. Open your TrailGuard profile → **Connect Telegram**
2. This opens a deep link to `@trail_guardbot` with your user ID and phone pre-filled
3. Tap **Start** in Telegram — the bot auto-registers your account in one tap
4. You will receive hazard broadcasts and emergency alerts directly in Telegram

Manual registration is also supported via `/register <userId> +65XXXXXXXX` in the bot chat.

---

## Monitoring

- **Prometheus** scrapes Kong metrics every 15 seconds at `:9090`
- **Grafana** at `:13000` (default login: `admin` / `admin`) visualises request rates, latencies, and error rates per route
- **Kong access logs** are written to `/tmp/kong-access.log` inside the Kong container
