#!/usr/bin/env bash
# ─── Step 1: One-time Azure setup ────────────────────────────────────────────
# Run this ONCE before any deployment.
# Assumes: az CLI installed, logged in with "az login", correct subscription set.

set -euo pipefail

RESOURCE_GROUP="esd-t06-trailguard"
AKS_CLUSTER="esd-t06-trailguard-AKS"
ACR_NAME="trailguardt06acr"

echo "=== [1/3] Attaching ACR to AKS (grants AcrPull to the cluster identity) ==="
az aks update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --attach-acr "$ACR_NAME"

echo "=== [2/3] Getting AKS credentials into kubectl ==="
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --overwrite-existing

echo "=== [3/3] Verify cluster is reachable ==="
kubectl get nodes

echo ""
echo "Setup complete. Now run: bash scripts/02-build-push.sh"
