# Google and Apple sign-in handoff

The app and EAS file variables are configured. Complete these account-owned steps before testing a release build.

## Firebase Authentication

1. Open Firebase Console for `gemfort` → Authentication → Sign-in method.
2. Enable **Google**.
3. Enable **Apple** and enter the Apple Services ID, Team ID, Key ID, and Apple private key created below.

## Apple Developer

1. Enable **Sign in with Apple** for `app.gemfort.dev`, `app.gemfort.preview`, and `app.gemfort`.
2. Create a Sign in with Apple key and a Services ID for Firebase's Apple provider configuration.
3. Regenerate the affected provisioning profiles in EAS before building iOS.

## Android fingerprints

Install Google Cloud CLI, authenticate, then make it available in your shell:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project gemfort
```

Register the SHA-1 and SHA-256 fingerprints for each Android Firebase app (`app.gemfort.dev`, `app.gemfort.preview`, and `app.gemfort`):

- local debug/build signing key;
- EAS-managed signing key (`eas credentials -p android`);
- Play upload key;
- Google Play App Signing key from Play Console → Setup → App integrity.

One existing SHA-1 was added to the production Firebase app during this implementation. Download fresh Firebase configuration after completing the remaining fingerprints and replace the corresponding sensitive EAS file variables.

## EAS builds

The sensitive `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_PLIST` file variables now exist in development, preview, and production. Build a new binary after completing Firebase/Apple setup; OTA updates cannot add this native functionality.

```powershell
bun run build:dev:android
bun run build:dev:ios
bun run build:preview:android
bun run build:preview:ios
eas build --profile production --platform all
```

Use Google APIs/Play system images for Android emulators. Test a Play-signed Android artifact and TestFlight iOS build before release.

## Local rule tests

After the Google Cloud CLI setup above, run:

```powershell
bun run test:rules
```
