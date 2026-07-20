#!/usr/bin/env bash
# Flips the fresh-cup-api Service to point at the "blue" or "green"
# Deployment slot. Vanilla Kubernetes has no built-in blue/green
# primitive — this is the standard "two Deployments, one Service, patch
# the selector" approach, deliberately not Argo Rollouts/Flagger (a new,
# fairly heavy dependency this platform's size doesn't need).
#
# Usage: ./switch.sh blue|green
set -euo pipefail

SLOT="${1:?Usage: switch.sh blue|green}"
if [[ "$SLOT" != "blue" && "$SLOT" != "green" ]]; then
  echo "error: slot must be 'blue' or 'green', got '$SLOT'" >&2
  exit 1
fi

NAMESPACE="fresh-cup"

echo "Verifying $SLOT deployment is ready before cutting over..."
kubectl -n "$NAMESPACE" rollout status "deployment/fresh-cup-api-$SLOT" --timeout=180s

echo "Switching Service fresh-cup-api to slot=$SLOT..."
kubectl -n "$NAMESPACE" patch service fresh-cup-api \
  -p "{\"spec\":{\"selector\":{\"app\":\"fresh-cup-api\",\"slot\":\"$SLOT\"}}}"

echo "Done. fresh-cup-api now routes to the $SLOT deployment."
echo "Leave the other slot's Deployment running as an instant rollback target — scale it down manually once you're confident in $SLOT."
