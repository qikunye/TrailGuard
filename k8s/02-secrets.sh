#!/usr/bin/env bash
# Creates the trailguard-secrets Kubernetes Secret from Services/.env.
# Run this once before applying manifests. Safe to re-run (uses --dry-run + apply).
# Usage: bash k8s/02-secrets.sh

set -euo pipefail
NAMESPACE="trailguard"
SECRET_NAME="trailguard-secrets"
ENV_FILE="$(dirname "$0")/../Services/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Run from the repo root."
  exit 1
fi

echo "Creating secret '$SECRET_NAME' in namespace '$NAMESPACE' from $ENV_FILE ..."

kubectl create secret generic "$SECRET_NAME" \
  --namespace="$NAMESPACE" \
  --from-env-file="$ENV_FILE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Done. Verify with: kubectl get secret $SECRET_NAME -n $NAMESPACE"
