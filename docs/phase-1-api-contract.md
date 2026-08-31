# GemFort backend migration — Phase 1 API contract and security boundary

**Status:** Contract/design and local Hono shell complete; nothing deployed  
**Date:** 2026-08-11  
**Branch:** `codex/phase-1-api-contract`  
**Depends on:** [Phase 0 baseline](./phase-0-backend-migration-baseline.md) and [ADR-001](./adr-001-gemfort-api-consolidation.md)

## Objective

Define the stable HTTP boundary for the one Hono API before moving business logic or changing mobile clients. This phase is deliberately design-first: no Firebase resource, Firestore data, Auth provider, Storage bucket, trigger, schedule, or production endpoint is changed.

The target remains one Cloud Run-backed gen2 HTTP API function, provisionally `gemfortApi`, in `asia-south1`. The Hono application must stay independent of Firebase callable transport details so the deployment adapter can be tested locally and swapped without changing route behavior. Hono’s current Node guidance uses the Node adapter, and its Cloud Run guidance serves the app on the platform-provided port; the adapter decision is therefore isolated from the route contract. See the [Hono Node.js guide](https://hono.dev/docs/getting-started/nodejs) and [Hono Cloud Run guide](https://hono.dev/docs/getting-started/google-cloud-run).

## Boundary and URL strategy

### Canonical API

The future client-facing API uses one configurable base URL:

```text
${GEMFORT_API_BASE_URL}/v1/...
```

The base URL is supplied through the app’s existing environment/configuration mechanism. It must not be constructed from a Firebase callable function name in screens or feature services.

The API must support a stable custom domain before production cutover. A provider URL may be used for development and canary testing, but production code should not hard-code a generated Cloud Run or Cloud Functions hostname.

### Migration compatibility

Existing callable functions stay deployed during migration. The client transport changes only after route parity tests and a canary pass. A temporary compatibility adapter may expose:

```text
POST /v1/compat/callable/:functionName
```

It accepts the existing callable request envelope `{ "data": ... }` and returns the existing callable response envelope `{ "result": ... }` or `{ "error": ... }`. This adapter is a migration tool, not the long-term public API. It must have an explicit allowlist of callable names and must never dispatch arbitrary module or function names.

## Transport contract

### Request headers

| Header | Required | Meaning |
|---|---|---|
| `Authorization` | All authenticated routes | `Bearer <Firebase ID token>` |
| `Content-Type` | JSON mutations | `application/json` |
| `X-Firebase-AppCheck` | Enforced after client readiness | Firebase App Check token; never put this token in a URL |
| `Idempotency-Key` | Required for mutation routes after cutover | Client-generated key for safe retries; scoped to user, route, and request body hash |
| `X-Request-Id` | Optional | Client correlation value; server generates one if absent and returns it |
| `Accept` | Optional | `application/json` |

Firebase’s custom-backend App Check guidance uses the `X-Firebase-AppCheck` header and recommends server-side Admin SDK verification. The server must reject invalid tokens when enforcement is enabled; App Check is an additional app-attestation layer and never replaces Firebase Auth. See [Protect custom backend resources with App Check](https://firebase.google.com/docs/app-check/custom-resource-backend).

### Success envelope

Canonical routes return:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_01..."
  }
}
```

The `data` value is the existing callable result for parity. `meta` is additive and must not contain secrets, raw tokens, or unbounded provider payloads.

### Error envelope

```json
{
  "error": {
    "code": "permission-denied",
    "message": "Only the owner can request cancellation.",
    "requestId": "req_01...",
    "details": null
  }
}
```

Rules:

- `code` is a stable lower-case machine value.
- `message` is safe for client display and must not expose Firestore paths, secret names, provider tokens, stack traces, or user existence beyond the current callable behavior.
- `requestId` is always returned and logged.
- `details` is omitted or `null` by default. Validation details must be allowlisted and must not echo sensitive input.
- The compatibility adapter additionally returns the legacy callable `error.status` uppercase value so the current retry/error mapping continues to work during cutover.

### Error-to-HTTP mapping

| Firebase callable code | HTTP | Retry default |
|---|---:|---|
| `invalid-argument` | 400 | No |
| `unauthenticated` | 401 | Refresh token once, then stop |
| `permission-denied` | 403 | No |
| `not-found` | 404 | No |
| `already-exists` | 409 | No; reconcile/read first |
| `failed-precondition` | 412 | No |
| `resource-exhausted` | 429 | Bounded backoff if endpoint says safe |
| `deadline-exceeded` | 504 | Bounded retry only for idempotent requests |
| `unavailable` | 503 | Bounded retry only for idempotent requests |
| `cancelled` | 499 | No automatic mutation retry without idempotency |
| `internal` / `unknown` / `data-loss` | 500 | No mutation retry unless idempotency is proven |

## Route inventory and ownership

These are canonical route proposals mapped to the 18 current callable/API functions. The existing function name remains in the table so parity testing can compare old and new behavior.

| Method and route | Current callable | Auth and ownership | Idempotency / special handling |
|---|---|---|---|
| `POST /v1/ap/requests` | `createApRequest` | Authenticated; sender owns the selected contact and gems | Required; prevent duplicate AP records and duplicate gem locks |
| `POST /v1/ap/requests/:apId/respond` | `respondApRequest` | Authenticated; receiver must own the AP response role | Required; accepted/rejected state transition |
| `POST /v1/ap/requests/:apId/cancel` | `cancelApRequest` | Authenticated; sender while pending | Required; terminal/state transition |
| `POST /v1/ap/records/:apId/sale` | `recordApGemSale` | Authenticated; receiver and gem line ownership checked in Firestore | Required; one sale per gem line |
| `POST /v1/ap/records/:apId/return` | `returnApGem` | Authenticated; receiver and unsold line ownership checked | Required; one return per gem line |
| `POST /v1/ap/records/:apId/payment-sent` | `apPaymentSent` | Authenticated; receiver and AP payment state checked | Required; payment method/amount/cheque fields validated |
| `POST /v1/ap/records/:apId/payment-received` | `apPaymentReceived` | Authenticated; sender confirms receipt | Required; must not double-complete money/gem state |
| `POST /v1/ap/records/:apId/cancellation` | `requestApCancellation` | Authenticated; sender after acceptance | Required; one pending cancellation request |
| `POST /v1/ap/records/:apId/cancellation/respond` | `respondApCancellation` | Authenticated; receiver accepts/rejects | Required; state transition plus notifications |
| `DELETE /v1/ap/records/:apId` | `deleteApRecord` | Authenticated; sender or receiver; terminal AP only | Required; safe repeat should return the same terminal outcome |
| `POST /v1/services/:serviceId/cancellation` | `requestServiceCancellation` | Authenticated; service owner | Required; direct cancellation or provider request |
| `POST /v1/services/:serviceId/cancellation/respond` | `respondServiceCancellation` | Authenticated; service provider | Required; accepted/rejected state transition |
| `POST /v1/auth/phone/link` | `linkVerifiedPhone` | Authenticated; FPNV token independently verified against FPNV JWKS | Required; use recent token/unique phone conflict handling |
| `DELETE /v1/account` | `deleteMyAccount` | Authenticated; recent Firebase Auth required | Required; destructive operation; consider limited-use App Check replay protection after client support |
| `POST /v1/flights/search` | `searchFlights` | Authenticated; no Firestore ownership role | Request hash/cache; upstream rate limit and timeout |
| `POST /v1/flights/calendar` | `getFlightPriceCalendar` | Authenticated; no Firestore ownership role | Request hash/cache; upstream rate limit and timeout |
| `POST /v1/flights/booking-link` | `createFlightBookingLink` | Authenticated; URL host allowlist | Request hash/cache; never accept arbitrary redirect hosts |
| `POST /v1/admin/news/sync` | `runNewsSyncNow` | Authenticated plus `users/{uid}.role == admin` | Admin-only; long-running provider call; keep scheduled `syncGemNews` separate |

The route shape is intentionally explicit about resource IDs, but the first implementation must preserve the existing callable payloads through a documented adapter. Payload reshaping and resource naming changes are separate compatibility decisions, not incidental refactors.

## Payload parity matrix

The following current payload fields are confirmed from the source and become the minimum contract inputs. Phase 2 implementation must add schemas and negative tests for every field, including bounds and state rules.

| Callable | Current input shape |
|---|---|
| `createApRequest` | `receiverContactId`, optional `receiverBusinessId`, optional `expectedDurationDays`, optional `agreementNotes`, `items[]` with `gemId`, `agreedPrice`, optional `currency` |
| `respondApRequest` | `apId`, `action: accepted \| rejected`, optional `rejectionReason` |
| `cancelApRequest` | `apId` |
| `recordApGemSale` | `apId`, `gemId`, `soldPrice`, `soldToName` |
| `returnApGem` | `apId`, `gemId` |
| `apPaymentSent` | `apId`, `method: cash \| transfer \| cheque`, `amount`, optional `chequeId` |
| `apPaymentReceived` | `apId`, `method: cash \| transfer \| cheque`, optional `chequeId` |
| `requestApCancellation` | `apId` |
| `respondApCancellation` | `apId`, `action: accepted \| rejected` |
| `deleteApRecord` | `apId` |
| `requestServiceCancellation` | `serviceId` |
| `respondServiceCancellation` | `serviceId`, `action: accepted \| rejected` |
| `linkVerifiedPhone` | `token` containing the device verification JWT; server validates signature, issuer, audience, algorithm, subject format, and Auth uniqueness |
| `deleteMyAccount` | No business payload; server derives UID from Auth token and validates recent `auth_time` |
| `searchFlights` | `origin`, `destination`, `departureAt`, optional `returnAt`, `oneWay`, `direct`, `currency`, optional bounded `limit` and `page` |
| `getFlightPriceCalendar` | Same normalized flight criteria used by the calendar provider |
| `createFlightBookingLink` | `url`; server allowlists `aviasales.com` hosts before calling Travelpayouts |
| `runNewsSyncNow` | No business payload; server derives UID and checks admin role |

## Middleware and request lifecycle

The Hono registration order is part of the design and must be covered by tests:

1. Generate or validate `X-Request-Id` with a bounded length and safe character set.
2. Apply secure response headers and a strict JSON content policy.
3. Handle `OPTIONS` preflight with allowlisted origins and headers. Native Expo/React Native requests do not require browser CORS, but web clients do.
4. Apply a request body limit before parsing JSON.
5. Verify the Firebase ID token for authenticated routes using Firebase Admin Auth. The verified token, not a request body field, supplies `uid`.
6. Verify App Check according to an explicit environment mode. `off` is allowed only for local emulator tests; `audit` records failures without blocking in controlled staging; `enforce` rejects missing/invalid tokens in production after all clients send them.
7. Validate route params, query, headers, and JSON body with shared Zod schemas.
8. Resolve route-level role/resource ownership and idempotency state.
9. Execute the domain handler with a route-specific timeout budget.
10. Map known errors to the stable envelope; map unknown errors to a safe 500 response and structured server logs.
11. Return `X-Request-Id` and duration metadata only when it does not leak sensitive timing or provider details.

Firebase’s Admin SDK exposes `getAppCheck().verifyToken()` for custom backend verification. Replay protection consumes a token and adds a network round trip, so it should be limited to low-volume sensitive actions such as account deletion after end-to-end support is validated. See the [Admin App Check API](https://firebase.google.com/docs/reference/admin/node/firebase-admin.app-check.appcheck) and [custom backend guidance](https://firebase.google.com/docs/app-check/custom-resource-backend).

## Authentication and authorization policy

### Authentication

- Reject missing or malformed `Authorization` with `401 unauthenticated`.
- Verify Firebase ID tokens using the Admin SDK in the API process.
- Never accept `uid`, `role`, `ownerUid`, or `providerUid` as authority from the client.
- Preserve the current delete-account recent-auth requirement using the verified token’s `auth_time` and a five-minute maximum age.
- Use `checkRevoked: true` only where the route’s security benefit justifies the additional verification cost; the decision must be explicit and measured.

Cloud Run user-authentication guidance also describes Firebase Auth ID tokens as an `Authorization: Bearer` header for end-user requests. The API owns Firebase token verification because Cloud Run IAM authentication is not the right end-user authorization model for Expo/React Native users. See [Google Cloud Run end-user authentication](https://docs.cloud.google.com/run/docs/authenticating/end-users).

### Authorization

- AP and service routes must re-run resource ownership/state checks inside the API process immediately before mutation.
- Admin news sync must check the Firestore user role server-side.
- Phone linking must bind the FPNV-verified phone to the Firebase Auth UID from the verified ID token.
- Account deletion must wipe the same Firestore and Storage scope as the current function before the client deletes Auth.
- A successful Auth check alone is never sufficient for a mutation involving another user’s resource.

## Expo/React Native client compatibility

The client transport remains one shared module. The migration changes that module, not individual screens:

1. Resolve `GEMFORT_API_BASE_URL` from environment/configuration.
2. Obtain the cached Firebase ID token and force-refresh once only after a 401.
3. Obtain and send App Check only after the client App Check provider/configuration is verified; do not fabricate or silently omit it in production enforcement mode.
4. Send JSON and the correlation/idempotency headers.
5. Parse the canonical envelope and map stable API error codes to the existing client error behavior.
6. Preserve the existing direct Firestore subscriptions, offline queues, Auth SDK flows, Storage paths, and local state cleanup.

The mobile transport must not import a server-only Hono client type if doing so causes a native bundle or environment leak. A shared schema/type package is acceptable only after the build graph proves it contains no Firebase Admin, Node-only, or secret-bearing imports.

## Observability and SLO design inputs

Every request log must include:

- `requestId`
- route template, not raw URL with sensitive query values
- HTTP status and stable error code
- verified `uid` hash or redacted identity field, never a raw token
- App Check result category, not the token
- duration and upstream duration where available
- deployment revision/version
- idempotency outcome where applicable

Initial route classes for Phase 2 performance budgets:

| Class | Routes | Initial target to validate |
|---|---|---|
| Interactive read/provider | Flight search and calendar | P95 under 3 seconds excluding upstream outage; cache hit target under 300 ms |
| Interactive mutation | AP/service/phone routes | P95 under 1.5 seconds in warm controlled tests; no duplicate side effects on retry |
| Destructive | Account deletion | Correctness first; explicit 540-second upper bound retained until measured |
| Administrative/provider | Manual news sync | Not part of interactive SLO; remain admin-only and separately observable |

These are validation targets, not production promises. Phase 2 must compare controlled warm/cold measurements against the Phase 0 production baseline.

## Phase 1 acceptance criteria

- [x] Define canonical base URL and versioning policy.
- [x] Map all 18 callable/API functions to owned routes.
- [x] Record current payload fields and response/error compatibility rules.
- [x] Define Firebase Auth, App Check, CORS, validation, idempotency, and authorization boundaries.
- [x] Preserve triggers, schedules, Firestore, Storage, and Auth-delete gen1 as explicit non-goals.
- [x] Implement the non-deployed Hono application shell with health/readiness/error boundaries.
- [x] Add shell contract tests with `app.request()` before connecting existing business handlers.
- [x] Add client transport behind a feature flag after the API shell passes contract tests.

## Phase 2 entry criteria

Phase 2 may begin with the deployment adapter, Firebase Admin initialization, token/App Check middleware tests, and one low-risk read/provider route. It must not migrate destructive AP/account mutations first. The existing callable functions remain the rollback path until endpoint parity and canary criteria are met.
