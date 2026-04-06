#!/usr/bin/env bash
# ─── Step 2: Build all images and push to ACR ────────────────────────────────
# Usage (backend only, first run):
#   bash scripts/02-build-push.sh
#
# Usage (include frontend, after getting Kong's IP):
#   bash scripts/02-build-push.sh --with-frontend <KONG_EXTERNAL_IP>
#
# Example:
#   bash scripts/02-build-push.sh --with-frontend 20.188.111.42

set -euo pipefail

ACR="trailguardt06acr.azurecr.io"
WITH_FRONTEND=false
KONG_IP=""

if [[ "${1:-}" == "--with-frontend" ]]; then
  WITH_FRONTEND=true
  KONG_IP="${2:?Usage: $0 --with-frontend <KONG_EXTERNAL_IP>}"
fi

# ── Login to ACR ──────────────────────────────────────────────────────────────
echo "=== Logging in to ACR ==="
az acr login --name trailguardt06acr

# ── Helper: build + tag + push ────────────────────────────────────────────────
push() {
  local name=$1
  local context=$2
  local dockerfile=$3
  shift 3
  echo "--- Building $name (linux/amd64) ---"
  docker build --platform linux/amd64 -t "$ACR/$name:latest" -f "$dockerfile" "$@" "$context"
  docker push "$ACR/$name:latest"
}

# ── Atomic services (shared Dockerfile with SERVICE build arg) ────────────────
push hiker-profile      Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Hiker_Profile_Service
push trail-condition    Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Trail_Condition_Service
push incident-risk      Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Incident_Risk_Service
push hike-completion    Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Hike_Completion_Service
push incident-service   Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Trail_Incident
push emergency-contacts Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Emergency_Contacts_Service
push nearby-users       Services/atomic  Services/atomic/Dockerfile      --build-arg SERVICE=Nearby_Users_Service
push completed-user-hike Services/atomic Services/atomic/Dockerfile     --build-arg SERVICE=Completed_User_Hike_Service

# ── Wrapper services ──────────────────────────────────────────────────────────
push weather-wrapper    Services         Services/wrappers/Dockerfile    --build-arg SERVICE=Weather_Wrapper
push evaluator-wrapper  Services         Services/wrappers/Dockerfile    --build-arg SERVICE=Evaluator_Wrapper
push googlemaps-wrapper Services         Services/wrappers/Dockerfile    --build-arg SERVICE=GoogleMaps_Wrapper
push notification-wrapper Services       Services/Dockerfile.notification

# ── Orchestrator services (same Dockerfile, different entrypoints) ────────────
push orchestrator       Services         Services/orchestrator/Dockerfile
push incident-reporting Services         Services/orchestrator/Dockerfile
push report-ingestion   Services         Services/orchestrator/Dockerfile
push alternative-route  Services         Services/orchestrator/Dockerfile

# ── Frontend (only if --with-frontend flag provided) ─────────────────────────
if [[ "$WITH_FRONTEND" == true ]]; then
  echo "--- Building frontend with VITE_ORCHESTRATOR_URL=http://$KONG_IP/api/orchestrator ---"
  source Frontend/.env  # Load VITE_FIREBASE_* and other vars
  docker build --platform linux/amd64 -t "$ACR/frontend:latest" \
    --build-arg VITE_ORCHESTRATOR_URL="http://$KONG_IP/api/orchestrator" \
    --build-arg VITE_MAPS_WRAPPER_URL="http://$KONG_IP/api/maps" \
    --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
    --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
    --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
    --build-arg VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
    --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
    --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
    --build-arg VITE_FIREBASE_MEASUREMENT_ID="$VITE_FIREBASE_MEASUREMENT_ID" \
    --build-arg VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY" \
    Frontend/
  docker push "$ACR/frontend:latest"
  echo ""
  echo "Frontend pushed. Now run: bash scripts/03-deploy.sh --with-frontend"
else
  echo ""
  echo "Backend images pushed. Next steps:"
  echo "  1. Deploy backend: bash scripts/03-deploy.sh"
  echo "  2. Get Kong IP:    kubectl get svc kong -n trailguard"
  echo "  3. Build frontend: bash scripts/02-build-push.sh --with-frontend <KONG_IP>"
  echo "  4. Deploy frontend: bash scripts/03-deploy.sh --with-frontend"
fi
