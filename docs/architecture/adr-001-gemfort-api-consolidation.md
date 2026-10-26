# ADR-001: Consolidate GemFort callable APIs into one Hono HTTP function

**Status:** Accepted for implementation planning  
**Date:** 2026-08-11  
**Decision owner:** GemFort engineering  
**Related baseline:** [Phase 0 backend migration baseline](./phase-0-backend-migration-baseline.md)

## Context

GemFort currently has 18 callable/API functions spread across multiple TypeScript modules and deployed as separate Firebase Functions. The mobile/web client reaches them through a shared helper that builds regional Cloud Functions URLs and sends Firebase ID tokens. The same Firebase project also owns Firestore, Storage, Authentication, Firestore/Eventarc triggers, and scheduled jobs that must remain stable during the API migration.

The goal is a more coherent API boundary with better control over routing, middleware, observability, deployment, and performance tuning while retaining Firebase Auth and Firebase-managed data services. The project has explicitly excluded Cloudflare Workers from this decision.

## Decision

Build one Hono application as a Cloud Run-backed 2nd-generation HTTP function, provisionally named `gemfortApi`, and migrate the 18 callable/API workloads behind versioned HTTP routes.

The application will use a layered boundary:

```text
Expo / React Native / web clients
        |
        | Firebase ID token + existing App Check posture
        v
gemfortApi (one gen2 HTTP function, Cloud Run-backed)
        |
        +-- Hono middleware: request ID, auth, App Check, CORS, limits, errors
        +-- versioned routes and compatibility adapters
        +-- domain services and validation
        +-- Firebase Admin SDK / external providers
        v
Firestore / Auth / Storage / FCM / external APIs
```

The implementation must preserve the existing Firebase resources and operational workloads:

- Keep the 12 Firestore/Eventarc gen2 triggers deployed separately.
- Keep the four schedules unchanged.
- Keep the `onAuthUserDeleted` cleanup trigger on gen1 because the documented gen2 Auth trigger set does not provide a user-deleted event.
- Keep direct client Firestore subscriptions, offline persistence, Storage, and Firebase Auth flows unchanged unless a separate decision authorizes a change.

The Hono dependency version and Cloud Run/Functions runtime settings will be pinned during implementation from the project’s supplied Hono documentation and current official runtime documentation. Phase 0 records the current deployed Node.js 22 Functions runtime; it does not upgrade or deploy a runtime.

## Options considered

### Option A — One consolidated Hono HTTP function

Chosen. It gives the team one explicit API boundary, centralized middleware and error handling, a single client base URL, shared observability, and a controlled place to tune concurrency and resource settings. It also keeps the deployment integrated with the existing Firebase/GCP project and Firebase Admin SDK access.

### Option B — Keep separate callable functions and only upgrade versions

Not chosen as the target architecture. It is the lowest-risk compatibility step, but it leaves the current fragmented API boundary, per-function configuration drift, and duplicated transport/auth handling in place. Individual functions can still be retained temporarily as rollback or trigger workloads.

### Option C — Cloudflare Workers

Out of scope by explicit product direction. No implementation or migration work will target Workers.

## Consequences

### Benefits

- One route tree, middleware policy, error model, and API versioning strategy.
- One place to instrument latency, authorization failures, App Check decisions, provider calls, and request correlation.
- Fewer independently deployed HTTP entry points for the client-facing API.
- More explicit control over concurrency, instance limits, timeout budgets, and rollout strategy than the current callable-by-callable surface.
- A transport boundary that remains straightforward for Expo, React Native, and web clients using standard `fetch` plus Firebase Auth token acquisition.

### Costs and risks

- A single deployment becomes a larger blast radius; route isolation, timeouts, circuit breakers, and staged rollout are mandatory.
- Callable protocol compatibility must be intentionally implemented; Hono does not automatically reproduce Firebase callable semantics.
- A consolidated process can suffer resource contention between fast interactive endpoints and slow provider/sync-like work unless those workloads are bounded or kept outside the API process.
- The AP lifecycle has both direct client Firestore writes and server callables; moving only the HTTP transport without resolving ownership can preserve or amplify duplicate-write bugs.
- `onAuthUserDeleted` cannot be honestly upgraded to gen2 without changing its event architecture.
- “One backend” does not mean “one handler for triggers and schedules.” Firebase-managed event workloads remain separate by design.

## Required implementation constraints

1. Verify Firebase ID tokens server-side; never trust a client-supplied UID.
2. Preserve App Check behavior and document whether the API rejects missing/invalid tokens or follows the existing callable posture.
3. Use explicit route-level authorization and validation, especially for AP mutations, account deletion, and phone linking.
4. Add idempotency protection to retried mutations and webhook-like provider interactions.
5. Keep slow scheduled jobs out of interactive request latency budgets; do not move scheduled jobs into the API without a separate approval.
6. Provide a compatibility adapter so the mobile/web client can migrate through one shared transport module.
7. Deploy with a reversible cutover: shadow or canary where practical, measurable parity checks, and the existing callable functions retained until rollback criteria expire.
8. Add structured logs, metrics, traces/correlation IDs, alerting, and dashboards before production traffic is switched.

## Action items

- [ ] Produce the complete endpoint and payload compatibility matrix.
- [ ] Decide route naming/versioning and the temporary compatibility shape.
- [ ] Define Firebase ID-token and App Check middleware behavior.
- [ ] Define route-level authorization and resource ownership rules.
- [ ] Classify AP operations as client-authoritative, API-authoritative, or intentionally dual-path.
- [ ] Choose per-route timeout, concurrency, memory, minimum/maximum instance, and retry settings.
- [ ] Add unit, integration, emulator, and contract tests before cutover.
- [ ] Establish baseline SLOs from controlled cold/warm measurements, not only the current small production samples.
- [ ] Add monitoring policies and rollback/runbook procedures.
- [ ] Confirm the paused `dailyGemTrackNotifications` schedule is intentional before changing any operational state.

## Rejection criteria

The design must not proceed to production cutover if it:

- bypasses Firebase ID-token verification;
- silently changes App Check enforcement;
- changes Firestore/Auth/Storage rules or data behavior;
- duplicates or replaces Firestore triggers/schedules without explicit approval;
- exposes the old admin-only callable behavior to ordinary authenticated users;
- lacks a rollback path to the existing callable endpoints; or
- treats the gen1 Auth-delete trigger as gen2-compatible without an approved replacement event design.
