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
# --force confirms trigger retry policies non-interactively (every retried
# handler is idempotent). It would also delete live functions that are no
# longer exported, so refuse if any exist rather than deleting silently.
LIVE_ONLY="$(comm -13 \
  <(grep -oE '\b(on[A-Z][A-Za-z]+|daily[A-Za-z]+|sync[A-Za-z]+|gemfortApi)\b' functions/src/index.ts | sort -u) \
  <(firebase functions:list --project "$PROJECT" | awk -F'│' 'NR>3{gsub(/ /,"",$2); if($2!="") print $2}' | sort -u))"
if [[ -n "$LIVE_ONLY" ]]; then
  echo "Refusing to deploy: live functions missing from source would be deleted: ${LIVE_ONLY}" >&2
  exit 1
fi
firebase deploy --project "$PROJECT" --force \
  --only firestore:rules,firestore:indexes,storage,functions
echo "Deployed ${SHA} to ${PROJECT}."
