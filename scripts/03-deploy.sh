#!/usr/bin/env bash
# ─── Step 3: Apply Kubernetes manifests ──────────────────────────────────────
# Usage (backend + kong, first deployment):
#   bash scripts/03-deploy.sh
#
# Usage (include frontend, after Kong IP is known and frontend image is pushed):
#   bash scripts/03-deploy.sh --with-frontend

set -euo pipefail

WITH_FRONTEND=false
[[ "${1:-}" == "--with-frontend" ]] && WITH_FRONTEND=true

echo "=== [1] Applying namespace ==="
kubectl apply -f k8s/00-namespace.yaml

echo "=== [2] Applying Kong ConfigMap ==="
kubectl apply -f k8s/01-configmap-kong.yaml

echo "=== [3] Creating secrets from Services/.env ==="
bash k8s/02-secrets.sh

echo "=== [4] Deploying atomic services ==="
kubectl apply -f k8s/03-atomic-services.yaml

echo "=== [5] Deploying wrapper services ==="
kubectl apply -f k8s/04-wrapper-services.yaml

echo "=== [6] Deploying orchestrators ==="
kubectl apply -f k8s/05-orchestrators.yaml

echo "=== [7] Deploying Kong ==="
kubectl apply -f k8s/06-kong.yaml

if [[ "$WITH_FRONTEND" == true ]]; then
  echo "=== [8] Deploying frontend ==="
  kubectl apply -f k8s/07-frontend.yaml
fi

echo ""
echo "=== Waiting for pods to be ready (up to 3 minutes) ==="
kubectl rollout status deployment --namespace trailguard --timeout=180s 2>/dev/null || true

echo ""
echo "=== Pod status ==="
kubectl get pods -n trailguard

echo ""
echo "=== Services and IPs ==="
kubectl get svc -n trailguard

if [[ "$WITH_FRONTEND" == false ]]; then
  echo ""
  echo "Next steps:"
  echo "  1. Wait for Kong EXTERNAL-IP to appear (re-run: kubectl get svc kong -n trailguard)"
  echo "  2. Build frontend: bash scripts/02-build-push.sh --with-frontend <KONG_IP>"
  echo "  3. Deploy frontend: bash scripts/03-deploy.sh --with-frontend"
fi
