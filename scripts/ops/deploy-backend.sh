#!/usr/bin/env bash
# Deploy Firestore rules/indexes, Storage rules, and Cloud Functions from a
# clean, committed tree, stamping the release commit into the functions so
# `scripts/ops/check-deploy-parity.sh` can prove what is live.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROJECT="${1:-gemfort}"
if [[ -n "$(git status --porcelain -- functions firestore.rules firestore.indexes.json storage.rules firebase.json)" ]]; then
  echo "Refusing to deploy: backend files have uncommitted changes." >&2
  exit 1
fi

SHA="$(git rev-parse HEAD)"
# Firebase loads functions/.env.<project> at deploy time; RELEASE_SHA is not secret.
printf 'RELEASE_SHA=%s\n' "$SHA" > "functions/.env.${PROJECT}"

npm --prefix functions ci
npm --prefix functions test
firebase deploy --project "$PROJECT" \
  --only firestore:rules,firestore:indexes,storage,functions
echo "Deployed ${SHA} to ${PROJECT}."
