# TrailGuard

A trail safety and hiking management platform for Singapore's hiking community. TrailGuard helps hikers assess trail conditions before heading out, register and track hikes in real time, and trigger emergency responses when things go wrong.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [User Flows](#user-flows)
- [Key Design Decisions](#key-design-decisions)

---

## Overview

TrailGuard is built as a microservices application. A React frontend talks to a set of Python FastAPI services, which in turn coordinate with external providers — OutSystems for hiker profile data, Firebase for incident storage and authentication, OpenAI for AI-driven safety assessments, Twilio for SMS alerts, and Google Maps for geocoding and routing.

---

## Features

- **AI Trail Safety Assessment** — Get a GO / CAUTION / DO NOT GO recommendation driven by live weather, trail conditions, incident history, and your fitness profile
- **Hike Registration** — Register a planned hike on a specific trail with date, time, and party size
- **Real-Time GPS Tracking** — Track your hike live with a map showing your planned route and a live breadcrumb trail
- **Emergency Reporting** — Submit an on-trail incident that automatically notifies your emergency contacts and nearby hikers by SMS
- **Active Trail Incidents** — See live incidents on your trail from other hikers who are currently on it
- **Hiker Profile** — Set your fitness level, experience, and emergency contacts
- **Hazard Reporting** — Flag trail hazards for other hikers

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│                       Port 5173                          │
└──────────┬───────────────────────────┬───────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐   ┌───────────────────────────────┐
│  Trail Assessment    │   │   Incident Reporting           │
│  Orchestrator        │   │   Orchestrator                 │
│  Port 8000           │   │   Port 8008                    │
└────────┬─────────────┘   └──────┬────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Atomic Services                       │
│                                                         │
│  Hiker Profile  Trail Condition  Incident Risk  Hike    │
│  8001           8002             8003           Compl.  │
│                                                 8004    │
│                                                         │
│  Emergency      Nearby Users    Trail Incident  Compl.  │
│  Contacts 5003  5005            5004 (Firestore) Hike   │
│                                                  5006   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                       Wrappers                           │
│                                                         │
│  Weather  Google Maps  Evaluator (OpenAI)  Notification │
│  8005     8007         8006                5050 (Twilio) │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  External Services                       │
│                                                         │
│  Firebase    OutSystems    OpenAI     Twilio  Google    │
│  Auth +      HikerProfile  GPT-4o-   SMS     Maps      │
│  Firestore   Service       mini                        │
└─────────────────────────────────────────────────────────┘
```

### Service Types

| Type | Purpose |
|------|---------|
| **Orchestrators** | Fan out to multiple atomic services and aggregate results |
| **Atomic Services** | Single-responsibility, each owning one domain |
| **Wrappers** | Thin adapters that normalise external API responses |

---

## Services

### Orchestrators

| Service | Port | Purpose |
|---------|------|---------|
| Trail Safety Assessment | 8000 | 8-step assessment: fetches hiker profile, weather, trail conditions, incidents, and completion estimate, then calls OpenAI for a GO / CAUTION / DO NOT GO decision |
| Incident Reporting | 8008 | 8-step emergency response: reverse-geocodes location, notifies emergency contacts and nearby hikers via SMS, persists incident to Firestore |

### Atomic Services

| Service | Port | Purpose |
|---------|------|---------|
| Hiker Profile | 8001 | Hiker capability and experience data |
| Trail Condition | 8002 | Trail difficulty, operational status, active hazards |
| Incident Risk | 8003 | Incident counts and risk scores per trail |
| Hike Completion | 8004 | Estimates completion time and checks sunset safety |
| Trail Incident | 5004 | Creates and queries incident records in Firestore |
| Emergency Contacts | 5003 | Proxy to OutSystems EmergencyContactsAPI |
| Nearby Users | 5005 | Proxy to OutSystems HikeProgressAPI — returns actively hiking users on a trail |
| Completed User Hike | 5006 | Proxy to OutSystems HikeProgressAPI — starts and ends hike records, sets `isHiking` flag |

### Wrappers

| Service | Port | External API |
|---------|------|-------------|
| Weather | 8005 | Open-Meteo (free, no key required) |
| Google Maps | 8007 | Google Maps Platform — geocoding, reverse geocoding, directions |
| Evaluator | 8006 | OpenAI GPT-4o-mini — trail safety decision |
| Notification | 5050 | Twilio — SMS to emergency contacts and nearby hikers |

---

## Tech Stack

### Frontend
- **React 19** with React Router
- **Tailwind CSS 4**
- **Vite 5**
- **Leaflet / react-leaflet** — interactive maps
- **Firebase SDK** — authentication and storage

### Backend
- **Python 3** with **FastAPI** (all services except Notification Wrapper)
- **Flask** — Notification Wrapper only
- **httpx** — async inter-service HTTP
- **Firebase Admin SDK** — Firestore access in Trail Incident Service

### Infrastructure
- **Docker + Docker Compose** — 14 containers on a shared bridge network
- **Firebase** — Auth, Firestore, Storage
- **OutSystems** — External hiker profile and hike progress platform

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- API keys for Google Maps, OpenAI, Twilio, and Firebase (see [Environment Variables](#environment-variables))

### Running with Docker Compose

```bash
# Clone the repo
git clone https://github.com/gwxndolyn/TrailGuard.git
cd TrailGuard

# Add your .env files (see Environment Variables section)
# Frontend:  Frontend/.env
# Backend:   Services/.env

# Build and start all services
docker compose up --build

# Frontend will be available at http://localhost:5173
```

### Local Frontend Development

```bash
cd Frontend
npm install
npm run dev
```

Make sure the backend services are running (via Docker Compose) before starting the frontend locally.

---

## Environment Variables

### `Frontend/.env`

```env
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Google Maps (used directly by the frontend for route planning)
VITE_GOOGLE_MAPS_API_KEY=

# Backend service URLs
VITE_MAPS_WRAPPER_URL=http://localhost:8007
VITE_INCIDENT_URL=http://localhost:8008
VITE_HIKE_URL=http://localhost:5006
```

### `Services/.env`

```env
# Google Maps (backend)
GOOGLE_MAPS_API_KEY=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# OutSystems
OUTSYSTEMS_BASE_URL=https://<your-env>.outsystemscloud.com/HikerProfileService/rest/EmergencyContactsAPI
NEARBY_USERS_API_URL=https://<your-env>.outsystemscloud.com/HikerProfileService/rest/HikeProgressAPI
HIKE_PROGRESS_API_URL=https://<your-env>.outsystemscloud.com/HikerProfileService/rest/HikeProgressAPI

# Firebase service account (minified JSON on one line — for Firestore access in backend services)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

---

## User Flows

### Register a Hike

1. Go to **Register Trail**, select a trail and set your date and time
2. The interactive map calculates your route distance and estimated duration
3. Click **Check Trail** — the orchestrator runs a full 8-step safety assessment:
   - Fetches your fitness profile, live weather, trail conditions, and 30/90-day incident history concurrently
   - Estimates your completion time and checks whether you return before sunset
   - Calls OpenAI to produce a GO / CAUTION / DO NOT GO verdict with confidence score and key reasons
4. Review the assessment modal, then click **Register Hike**
5. The hike is saved and appears in Track Hike for selection

### Track a Hike

1. Go to **Track Hike** and select a registered hike from the list
2. Click **Start Hike** — the app:
   - Begins GPS tracking and draws your live path on the map alongside the planned route
   - Marks you as actively hiking in OutSystems (`isHiking = True`) — you now appear in nearby user queries
   - The dashboard shows any active incidents on your trail from other currently hiking users
3. Click **Stop Hike** when done — the app:
   - Marks you as no longer hiking in OutSystems (`isHiking = False`)
   - Records your hike with distance and end time
   - Removes the hike from your selectable list (you must register again to repeat it)

### Report an Emergency

1. On trail, open **Emergency** from the dashboard quick actions
2. Select severity (1–5), fill in injury type and description
3. Your GPS location is auto-detected and reverse-geocoded to a readable address
4. Submit — the Incident Reporting Service:
   - Notifies your emergency contacts (merged from your profile and OutSystems) via SMS
   - Notifies all hikers currently on the same trail via SMS
   - Persists the incident to Firestore
5. The confirmation page lists everyone who was notified

### View Active Trail Incidents

The dashboard shows **Active Hike Incidents on This Trail** when you have a registered upcoming hike. The endpoint:

```
GET /incidents/trail/{trailId}/active
```

fetches all incidents for the trail, then cross-references with `GetNearby/{trailId}` to only include incidents from hikers who still have `isHiking = True`. Once a hiker stops their hike, their incidents no longer appear.

---

## Key Design Decisions

**localStorage scoped by Firebase UID**
All client-side state (registered hikes, upcoming hike, active track session) is keyed by `uid` — e.g. `registeredHikes_${uid}` — so switching accounts never leaks data between users.

**OutSystems as the source of truth for hike lifecycle**
The `isHiking` flag in OutSystems drives both the nearby users list and active incident filtering. Starting a hike sets it to `True`; stopping sets it to `False`.

**Local emergency contacts merged with OutSystems**
The incident reporting orchestrator merges contacts from the user's local profile with those stored in OutSystems, deduplicating by phone number, so no one is missed even if OutSystems data is stale.

**Firestore composite index avoidance**
All Firestore queries use a single `where` clause and sort results in Python rather than using `order_by`, avoiding the need to manually create composite indexes in the Firebase console.

**AssessmentModal shared component**
The trail safety assessment modal is a single shared component (`src/components/assessment/AssessmentModal.jsx`) used by both the Register Hike page (with a Register button) and the Dashboard (without one), controlled by whether `onRegister` is passed as a prop.
