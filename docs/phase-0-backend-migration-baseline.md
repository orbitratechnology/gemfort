# GemFort backend migration — Phase 0 baseline

**Status:** Complete for the read-only baseline  
**Date:** 2026-08-11  
**Branch:** `codex/phase-0-baseline`  
**Project:** `gemfort` (`478360291449`)  
**Primary region:** `asia-south1`

## Purpose

Phase 0 establishes the facts and guardrails required before implementation of the consolidated Hono API. It does not deploy code, alter Firebase configuration, change Firestore data or rules, modify Authentication, change Storage, recreate triggers, or edit schedules.

The target chosen for the next phases is one Cloud Run-backed 2nd-generation HTTP function, provisionally named `gemfortApi`, containing the Hono API surface. Existing Firestore triggers, schedules, Storage, Authentication, and the Auth-delete cleanup behavior remain separate unless a later approved phase explicitly changes them.

## Non-negotiable migration guardrails

1. Firestore database, documents, indexes, rules, and offline-client behavior remain unchanged.
2. Firebase Authentication providers, user records, phone verification, custom claims, and client auth flows remain unchanged.
3. Firebase Storage buckets, paths, metadata, and rules remain unchanged.
4. Existing Firestore/Eventarc triggers remain deployed as their current functions.
5. Existing schedules remain deployed with their current expressions, time zones, enabled/paused state, and target functions.
6. The API migration must preserve Firebase ID-token verification and the existing App Check posture; it must not silently weaken either control.
7. No secrets or user data are copied into source control or migration artifacts.
8. The existing branch changes (`bun.lock` and the untracked `hono.md`) are preserved; this Phase 0 work does not reset or clean them.

## Live project inventory

| Area | Observed baseline |
|---|---|
| Firebase/GCP project | `gemfort`, project number `478360291449`, `ACTIVE` |
| Firebase region | `asia-south1` |
| Firestore | Native mode, default database `(default)`, `asia-south1`, pessimistic concurrency |
| Firestore App Engine integration | Disabled |
| Firestore delete protection | Disabled in the observed database metadata; unchanged |
| Firestore PITR | Not shown in the observed database metadata; not independently confirmed and unchanged |
| Storage | Five existing buckets, all observed in `ASIA-SOUTH1`; no bucket changes made |
| Secrets | Five Secret Manager entries observed; values were not read |
| Monitoring | No Cloud Monitoring alert policies returned by the read-only inventory query |
| App Check | The API is enabled, but enforcement/registration was not independently readable under the current principal; repository inspection found no App Check initialization or enforcement change |
| Authentication | Provider configuration was not independently readable under the current principal; no Auth data was exported or changed |

### Existing Secret Manager entries

Only names and metadata were inspected:

- `FIRECRAWL_API_KEY`
- `GEMINI_API_KEY`
- `TRAVELPAYOUTS_API_TOKEN`
- `TRAVELPAYOUTS_MARKER`
- `TRAVELPAYOUTS_PROJECT_ID`

All were labelled as Firebase-managed Functions secrets. The consolidated API must continue to consume secrets through runtime configuration, never through source-controlled values.

## Deployed function inventory

The live project contains 35 deployed functions in `asia-south1`:

| Category | Count | Migration treatment |
|---|---:|---|
| Callable/API functions | 18 | Consolidate into the Hono API behind one HTTP entry point, with an explicit compatibility layer during cutover |
| Firestore/Eventarc triggers | 12 | Leave deployed and unchanged |
| Scheduled functions | 4 | Leave deployed and unchanged |
| Authentication user-delete trigger | 1 | Leave as gen1 because Firebase currently does not provide an equivalent gen2 Auth user-delete event |

### Callable/API functions in scope for consolidation

`apPaymentReceived`, `apPaymentSent`, `cancelApRequest`, `createApRequest`, `createFlightBookingLink`, `deleteApRecord`, `deleteMyAccount`, `getFlightPriceCalendar`, `linkVerifiedPhone`, `recordApGemSale`, `requestApCancellation`, `requestServiceCancellation`, `respondApCancellation`, `respondApRequest`, `respondServiceCancellation`, `returnApGem`, `runNewsSyncNow`, and `searchFlights`.

`syncGemNews` is scheduled, not callable, and therefore remains outside the API consolidation boundary.

### Firestore/Eventarc triggers to preserve

`onAnnouncementPublished`, `onCertRequestCreated`, `onCertRequestUpdated`, `onChequeBounced`, `onLikeCreated`, `onListingOfferCreated`, `onNotificationCreated`, `onReportResolved`, `onServiceRequestCreated`, `onServiceRequestUpdated`, `onUserAccountAction`, and `onVerificationStatusChanged`.

The observed Eventarc triggers are application-event/protobuf triggers targeting the existing gen2 functions and use the project Compute Engine default service account. No trigger was recreated or edited.

### Schedules to preserve exactly

| Function | Observed schedule | Time zone | State | Phase 0 action |
|---|---|---|---|---|
| `syncExchangeRates` | `0 1 * * *` | `Asia/Colombo` | Enabled | Preserve |
| `dailyGemTrackNotifications` | `0 8 * * *` | `Asia/Colombo` | Paused | Preserve; confirm whether paused is intentional before any future operational change |
| `syncGemNews` | Every 6 hours | UTC | Enabled | Preserve |
| `syncExhibitions` | Daily at 00:00 | `Asia/Colombo` | Enabled | Preserve |

The paused notification schedule is an observed state, not a migration decision. Phase 0 does not resume it.

## Runtime and scaling baseline

Observed gen2 defaults across the deployed function set:

- Runtime: Node.js 22.
- Region: `asia-south1`.
- Maximum instances: 10 for all observed gen2 functions.
- Minimum instances: no configured minimum instances were observed.
- Most functions use concurrency 1.
- The following hot callables use concurrency 40: `apPaymentReceived`, `apPaymentSent`, `createApRequest`, `linkVerifiedPhone`, and `respondApRequest`.
- Most callable functions use 256 MiB and a 60-second timeout; flight callables use 30 seconds.
- `deleteMyAccount` and `runNewsSyncNow` use 1 GiB and a 540-second timeout.

These settings are baseline facts, not recommendations. The consolidated API must not inherit them blindly; Phase 1 will establish endpoint-specific timeout, concurrency, memory, min/max instance, and request-size policies.

## Request, latency, and error baseline

Cloud Logging request records returned 1,837 request rows over the observed seven-day window. Percentiles below are calculated from request records with a usable latency value; small sample sizes mean they are directional, not an SLO baseline.

| Service | Samples | P50 | P95 | P99 |
|---|---:|---:|---:|---:|
| `searchflights` | 26 | 284 ms | 2,841 ms | 4,492 ms |
| `getflightpricecalendar` | 22 | 505 ms | 1,810 ms | 2,254 ms |
| `linkverifiedphone` | 11 | 778 ms | 4,816 ms | 4,816 ms |
| `requestservicecancellation` | 13 | 2,236 ms | 4,696 ms | 4,696 ms |
| `respondservicecancellation` | 14 | 476 ms | 6,944 ms | 6,944 ms |
| `deletemyaccount` | 6 | 5 ms | 4,464 ms | 4,464 ms |
| `runnewssyncnow` | 4 | 19 ms | 2,458 ms | 2,458 ms |
| `syncgemnews` | 32 | 209,660 ms | 217,675 ms | 218,111 ms |
| `syncexhibitions` | 11 | 212,048 ms | 245,955 ms | 245,955 ms |

### Error signals

The seven-day Cloud Run revision query returned the following log-entry counts at severity `ERROR`. These are not deduplicated incidents or unique failed requests:

- `syncgemnews`: 84
- `syncexhibitions`: 21
- Two entries each for multiple API functions, including `createaprequest`, `respondapcancellation`, `linkverifiedphone`, `deletemyaccount`, `deleteaprecord`, `requestapcancellation`, `returnapgem`, `searchflights`, `appaymentreceived`, `cancelaprequest`, `appaymentsent`, `respondaprequest`, `respondservicecancellation`, and `runnewssyncnow`.

Representative repeated provider/application failures were `Gemini article extract failed` in `syncGemNews` and `Gemini exhibition extract failed` in `syncExhibitions`. Consolidating the HTTP API will not by itself solve provider failures in scheduled workloads.

The current transaction-abort query returned no matching `ABORTED`/transaction signals. This is evidence from the selected log query only, not proof that no transaction contention exists. No explicit cold-start classification was available in the request log fields; a controlled cold/warm probe is required in Phase 1.

## Repository-to-production mapping

### Functions source

- Functions source is `functions` in `firebase.json`.
- The Functions package uses Node.js 22, `firebase-admin` `^13.6.0`, and `firebase-functions` `^6.6.0`.
- This is the captured Phase 0 production/repository baseline. The local repair now uses `firebase-admin` `^14.2.0` and `firebase-functions` `^7.3.2`; no live function has been redeployed as part of that dependency update.
- The current Functions build is TypeScript compiled with `tsc`.
- Current tests run through `tsx --test`.
- The existing API logic is distributed across account, authentication, flights, GemTrack AP lifecycle, GemTrack service lifecycle, and news modules.

### Mobile/web client boundary

The shared client helper at `src/lib/firebase/call-function.ts` constructs callable URLs as:

```text
https://asia-south1-${projectId}.cloudfunctions.net/${name}
```

It sends the Firebase ID token, retries after refreshing an expired token on HTTP 401, and is imported by five client/service areas. The migration must replace this transport behind the same service boundary, not scatter endpoint changes across screens.

Observed call sites include:

- Phone verification: `linkVerifiedPhone`.
- Flights: `searchFlights`, `getFlightPriceCalendar`, `createFlightBookingLink`.
- Service lifecycle: `requestServiceCancellation`, `respondServiceCancellation`.
- Account lifecycle: `deleteMyAccount`.

The remaining callable surface is server-side or administrative and needs explicit route ownership and authorization tests before it is exposed through Hono.

### Direct Firestore write risk

The client AP lifecycle service performs direct offline Firestore writes and queues writes to collections including `gemtrack_ap_records`, `gemtrack_gems`, `gemtrack_ap_payments`, `gemtrack_transactions`, and `notifications`. The server AP callables implement overlapping lifecycle behavior. This duplication is an important correctness risk for the migration: Phase 1 must classify each operation as client-authoritative, API-authoritative, or intentionally dual-path before changing the transport.

Direct Firestore subscriptions, offline persistence, local write queues, Storage access, and Auth SDK flows are outside the API consolidation boundary and remain unchanged in Phase 0.

## Compatibility constraints

### Firebase callable protocol

The current callers use a custom HTTP helper against callable function URLs rather than the Firebase callable SDK. The Hono API must define a versioned HTTP contract and a compatibility adapter for the existing request/response and error semantics. The adapter must preserve:

- Firebase ID-token verification and `uid` derivation from the verified token.
- App Check handling according to the current project posture, with no silent downgrade.
- Existing client-visible success payloads and error categories during the migration window.
- Idempotency for retryable mutations.
- Request correlation IDs and structured logs.

### Authentication delete trigger limitation

The repository exports `onAuthUserDeleted` with the gen1 `functions.auth.user().onDelete()` API. Firebase’s current documented gen2 Auth trigger set does not include an Auth user-deleted event. Therefore, converting this trigger to gen2 would require a behavior/architecture change, such as an explicit deletion workflow or another event source. That conflicts with the Phase 0 guardrail to preserve Auth triggers.

Decision for this migration: keep `onAuthUserDeleted` gen1 and preserve its user-data cleanup behavior. The API consolidation must not claim that all deployed Functions can become gen2.

## Verification completed

The following checks passed on this branch:

- Root TypeScript check: `bun run typecheck`.
- Root unit tests: `bun run test:unit -- --runInBand` — 10 suites, 62 tests passed.
- Firestore rules tests: `bun run test:rules` — all 5 cases passed.
- Functions TypeScript build: `bun run build` from `functions`.
- Functions tests: `bun run test` from `functions` — 11 tests passed.

The first sandboxed Functions test attempt failed before test execution with a host-level Node `uv_os_get_passwd: ENOMEM` error. The unchanged command passed when retried with normal host resources; this was not a code failure.

## Phase 0 acceptance checklist

- [x] Create and switch to a dedicated branch: `codex/phase-0-baseline`.
- [x] Capture project, region, runtime, function, trigger, schedule, Storage, secrets, and database metadata.
- [x] Map callable exports to client transport and call sites.
- [x] Record a request, latency, and error baseline without reading secrets or user data.
- [x] Run repository and Functions verification commands.
- [x] Preserve all Firebase/GCP resources; no deployment or configuration mutation was performed.
- [x] Record the Auth-delete gen1 limitation explicitly.
- [ ] Obtain human confirmation that the paused `dailyGemTrackNotifications` schedule is intentional. No action is required to finish Phase 0, but this must be resolved before operational schedule work.

## Phase 1 entry criteria

Phase 1 can begin after the team accepts this baseline and confirms the paused schedule’s intended state. It should produce the Hono route contract, Firebase ID-token/App Check middleware design, request/response compatibility matrix, authorization matrix, idempotency policy, endpoint-level SLOs, and cold/warm performance probes before any production cutover.

## Evidence commands

The baseline was collected with read-only repository inspection and authenticated read-only Firebase/GCP CLI queries, including:

```text
firebase projects:list
firebase functions:list
firebase apps:list
gcloud functions list --v2 --project=gemfort --regions=asia-south1
gcloud eventarc triggers list --location=asia-south1 --project=gemfort
gcloud scheduler jobs list --location=asia-south1 --project=gemfort
gcloud firestore databases describe '(default)' --project=gemfort
gcloud storage buckets list --project=gemfort
gcloud secrets list --project=gemfort
gcloud monitoring policies list --project=gemfort
gcloud logging read ... --project=gemfort
```

No command in this phase deployed, deleted, migrated, or reconfigured a Firebase or Google Cloud resource.
