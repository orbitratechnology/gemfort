#!/usr/bin/env bash
# Fails when the live gemfortApi was not built from the given commit
# (default: HEAD). Reads the RELEASE_SHA stamped by deploy-backend.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROJECT="${PROJECT:-gemfort}"
REGION="${REGION:-asia-south1}"
EXPECTED="${1:-$(git rev-parse HEAD)}"

LIVE="$(gcloud run services describe gemfortapi --project "$PROJECT" --region "$REGION" \
  --format='value(spec.template.spec.containers[0].env)' \
  | tr ';' '\n' | sed -n "s/.*'name': 'RELEASE_SHA', 'value': '\([0-9a-f]*\)'.*/\1/p")"

if [[ "$LIVE" != "$EXPECTED" ]]; then
  echo "Deploy parity FAILED: live=${LIVE:-<unstamped>} expected=${EXPECTED}" >&2
  exit 1
fi
echo "Deploy parity OK: gemfortApi is ${LIVE}."
