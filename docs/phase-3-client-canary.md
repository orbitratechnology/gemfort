# GemFort backend migration — Phase 3 client canary transport

**Status:** Canary transport and native App Check wiring complete; live API deployed; mobile canary disabled  
**Date:** 2026-08-12  
**Branch:** `codex/phase-1-api-contract`  
**Related implementation:** [API client](../src/lib/api/api-client.ts) and [flight service](../src/features/flights/flights-service.ts)

## Delivered

- Added a shared client API transport using standard `fetch`, compatible with Expo SDK 57 and React Native.
- Added `EXPO_PUBLIC_GEMFORT_API_BASE_URL` for a client-visible API origin.
- Added `EXPO_PUBLIC_GEMFORT_API_CANARY`, defaulting to `false` in `.env.example`.
- Routed only the three flight provider methods (`searchFlights`, `getFlightPriceCalendar`, and `createFlightBookingLink`) through the Hono API when the canary flag is explicitly `true`.
- Kept all other callables on the existing Firebase callable transport.
- Preserved one Firebase ID-token refresh retry for the flight provider routes.
- Added canonical API error parsing and typed `ApiClientError` values.
- Added `Idempotency-Key` support for future mutation routes.
- Refused to call protected API routes when no App Check token provider is configured.

Expo SDK 57 exposes `EXPO_PUBLIC_` variables to the client bundle at build time, so the API base URL and canary flag are configuration values, never secrets. The implementation follows the [Expo SDK 57 environment-variable guidance](https://docs.expo.dev/guides/environment-variables/) and uses the platform Fetch implementation described in the [SDK 57 Expo reference](https://docs.expo.dev/versions/v57.0.0/sdk/expo/).

## Deliberate safety boundaries

- The current `.env` file was not changed.
- No API canary flag is enabled in the development, preview, or production EAS profiles. Only the dedicated `canary` profile enables it.
- Before Phase 4, no App Check client package, provider, or native configuration existed. Phase 4 now supplies the native provider while preserving the same fail-closed behavior until a token is available.
- No client mutation route was moved.
- Direct Firestore subscriptions, offline writes, Auth, Storage, and callable functions remain unchanged.

## Tests

- Root TypeScript check passes.
- Root unit suite passes: 11 suites, 66 tests.
- API-client tests cover missing App Check, Auth/App Check headers, one explicit Auth refresh retry, canonical success unwrapping, and error mapping. The Hono route suite covers validation parity for both read/provider flight routes.

## Canary enablement gate

The canary flag must remain disabled until all of the following are true:

1. A staging API base URL is available.
2. An Expo-compatible App Check provider is initialized for every target platform and supplies `X-Firebase-AppCheck` tokens.
3. The API secret binding and deployed service account are verified.
4. Flight-search contract tests pass against the canary with real Firebase Auth and App Check.
5. Cold/warm latency, provider error, and rollback behavior are measured.

The next operational slice is the [Phase 4 App Check device gate](./phase-4-app-check-canary.md): register the platform apps, build a fresh development client, verify real App Check tokens, and then run a staging-only canary. It must not enable the flag in production or move mutations until that validation succeeds.
