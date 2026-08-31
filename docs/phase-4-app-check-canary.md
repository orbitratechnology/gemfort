# Phase 4 — Native App Check provider and canary readiness

Status: Complete for the Android development canary; production provider validation and enforcement remain intentionally unchanged.

## What changed

- Added `@react-native-firebase/app-check@26.0.0`, matching the existing React Native Firebase v26 packages.
- Added the React Native Firebase App Check Expo config plugin.
- Added a native provider wrapper at `src/lib/firebase/app-check.native.ts`.
- Added a web/no-native fallback that returns no token; the API client remains fail-closed.
- Initialized App Check before the existing Firestore warm-up in the root layout.
- Development and preview builds use the Firebase debug provider.
- Production builds use Play Integrity on Android and App Attest with DeviceCheck fallback on Apple platforms.
- The API client now supplies `X-Firebase-AppCheck` from the native token provider by default.
- The isolated API endpoint is `https://asia-south1-gemfort.cloudfunctions.net/gemfortApi`; production and normal development/preview profiles do not target it yet.

## Deliberately not changed

- The API canary remains disabled by default.
- No Firebase Console App Check enforcement settings were changed.
- No debug token was added to source control or `eas.json`.
- Firestore, Auth, Storage, triggers, schedules, and existing callable clients were not migrated or modified.

## Completed operational checks

- Built the isolated Android canary profile with Expo SDK 57 and the native App Check provider.
- Confirmed the canary Metro bundle inlines `EXPO_PUBLIC_GEMFORT_API_CANARY=true` and the deployed Hono API base URL.
- Granted `roles/firebaseappcheck.tokenVerifier` to the deployed `gemfortApi` runtime service account.
- Seeded five non-production QA Auth personas for the end-to-end canary gate.
- Confirmed the live API health/readiness endpoints return 200 and protected routes reject missing or invalid Auth with 401.
- Registered the connected Android device's App Check debug token for the `app.gemfort` Firebase Android app.
- Confirmed the connected Android device retrieves an App Check token and uses the seeded QA Trader Auth session.
- Confirmed the real canary client returns 200 from `/v1/flights/search` and `/v1/flights/calendar` through the deployed Hono API.

## Required staging/device gate

1. Register the shared GemFort Android and iOS Firebase app IDs in Firebase App Check. The live project currently has one Android app (`app.gemfort`) and one iOS app (`app.gemfort`) shared by the development, preview, and production EAS profiles.
2. Build a fresh Expo development client because App Check is native code and cannot be delivered by Expo Go or an OTA update. **Complete:** the isolated Android canary artifact was built; the installed device must still reconnect to the development server for validation.
   The isolated Android canary profile is `eas build --profile canary --platform android`; it enables the API canary only for that build and keeps development, preview, and production profiles unchanged.
3. For a debug build, capture the generated App Check debug token from native logs and register it for the matching Firebase app. **Complete:** the connected Android device token is registered.
4. Verify the app can retrieve a token before enabling the API canary in a staging/preview build. **Complete:** Auth, App Check, search, and calendar were verified on-device against the deployed canary.
5. Configure the Cloud Run/Gen 2 API service account with the Firebase App Check Token Verifier role before enforcing the deployed endpoint. **Complete:** the role is now bound to `478360291449-compute@developer.gserviceaccount.com`.

The production provider is intentionally not exercised by this local slice. Play Integrity and App Attest require registered production app identities and real distribution/device conditions.
