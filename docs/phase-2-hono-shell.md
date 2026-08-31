# GemFort backend migration — Phase 2 Hono shell and first route

**Status:** Isolated Gen 2 API deployed; mobile canary disabled  
**Date:** 2026-08-12  
**Branch:** `codex/phase-1-api-contract`  
**Related design:** [Phase 1 API contract](./phase-1-api-contract.md)

## Delivered

### Hono runtime boundary

- Added Hono `4.13.2`.
- Updated the local Functions runtime dependencies to `firebase-admin` `14.2.0` and `firebase-functions` `7.3.2`, both compatible with the Node.js 22 deployment target.
- Added npm security overrides for `fast-xml-parser` and `uuid`, which are transitive dependencies of the Google Cloud client libraries used by Firebase Admin.
- Added `@hono/node-server` `2.1.1`.
- Added a Hono application factory at `functions/src/api/app.ts`.
- Added the read-only flight calendar route at `POST /v1/flights/calendar`, backed by the same validated provider service as the legacy callable.
- Added the provider-safe booking-link route at `POST /v1/flights/booking-link`, preserving the legacy Aviasales host allowlist and cached affiliate-link behavior.
- Added a Node HTTP adapter and gen2 `onRequest` deployment adapter at `functions/src/api/entry.ts`.
- Re-exported `gemfortApi` from `functions/src/index.ts` and deployed only `functions:gemfortApi` to `asia-south1`; the existing callable, trigger, and scheduled functions remain separate and deployed.

The adapter uses the current Node listener pattern and keeps the Hono app testable through the Web-standard `Request`/`Response` API. It is configured provisionally for `asia-south1`, 512 MiB, one CPU, concurrency 40, maximum 10 instances, and zero minimum instances. The flight routes’ `TRAVELPAYOUTS_API_TOKEN` is declared as a runtime secret binding on the future API function.

### Security middleware

- Firebase ID tokens are read from `Authorization: Bearer <token>`.
- Tokens are verified with Firebase Admin Auth; the UID is taken only from the verified token.
- Missing, malformed, expired, or invalid tokens return the canonical `401 unauthenticated` response.
- App Check is read from `X-Firebase-AppCheck`.
- App Check supports explicit `off`, `audit`, and `enforce` modes; the API factory defaults protected routes to `enforce`.
- App Check verification uses Firebase Admin SDK and `consume: false`; replay protection is not enabled for this first route.
- App Check failures never log the token value.

The middleware uses dependency injection for tests, so contract tests do not contact Firebase Auth or App Check services.

### First migrated read/provider routes

`POST /v1/flights/search`, `POST /v1/flights/calendar`, and `POST /v1/flights/booking-link` now share the existing domain logic with the current flight callables. This is a transport migration only:

- Existing callable `searchFlights` remains deployed and unchanged.
- Validation, Travelpayouts secret usage, cache key, upstream request, and normalized response remain in the existing domain module.
- Hono adds Auth/App Check enforcement and the canonical `{ data, meta }` response envelope to all three routes.
- Invalid requests map existing `HttpsError` values to stable HTTP errors.
- No client has been switched to the new route.

## Tests completed

- Functions TypeScript build passes.
- Functions test suite passes: 18 tests.
- Hono app tests cover health, readiness, request IDs, secure headers, 404 envelope, missing Auth, missing App Check, validation parity for both read routes, and booking-link host allowlisting.
- Node HTTP adapter test starts a local listener and verifies `/healthz` over real HTTP.
- Root TypeScript check remains passing from the preceding phase.

The Hono skill’s recommended `npx hono request` smoke command was attempted. The installed Hono package does not expose a CLI executable, so `npx.cmd hono request ...` could not resolve a runnable binary. The equivalent `app.request()` tests and real Node HTTP listener test pass; this is a tooling limitation, not an API test failure.

## Deployment safety

The isolated `gemfortApi` deployment is live at `https://asia-south1-gemfort.cloudfunctions.net/gemfortApi`. `/healthz` and `/readyz` return 200, while protected routes return the expected canonical 401 response for missing or invalid Auth. No Firestore/Auth/Storage data or rules, trigger, schedule, or existing callable function was changed. The mobile canary remains disabled until:

1. A real development client supplies a valid Firebase ID token and App Check debug token.
2. The canary flight routes pass end-to-end Auth/App Check tests.
3. Cold/warm latency and provider error behavior are measured.
4. Rollback to the existing callable endpoint is tested.

## Next implementation slice

The client transport and native App Check provider are documented in [Phase 3 client canary transport](./phase-3-client-canary.md) and [Phase 4 App Check readiness](./phase-4-app-check-canary.md). The Android flight canary is now proven, and the admin manual news route is documented in [Phase 5 admin news API](./phase-5-admin-news-api.md). AP mutations, phone linking, and account deletion remain later slices because they require stronger idempotency, ownership, recent-auth, and rollback verification.
