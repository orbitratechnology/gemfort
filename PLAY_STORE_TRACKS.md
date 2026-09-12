# GemFort Play Store testing tracks

GemFort has separate Android store-build profiles for Play Internal testing, Beta/Open testing, and Closed testing. All three use the existing `preview` EAS environment and the `app.gemfort` application ID. The production profile remains on the `production` environment and channel.

| EAS build profile | EAS Update channel | Play Console track | EAS submit track | Artifact |
|-------------------|-------------------|--------------------|------------------|----------|
| `internal` | `internal` | Internal testing | `internal` | Android App Bundle (`.aab`) |
| `beta` | `beta` | Beta/Open testing | `beta` | Android App Bundle (`.aab`) |
| `closed` | `closed` | Closed testing | `alpha` | Android App Bundle (`.aab`) |

EAS calls the Play closed-testing track `alpha`; this is the expected mapping for the Play Console track shown as Closed testing.

## Release commands

From the project root:

```powershell
bun run release:play:internal
bun run release:play:beta
bun run release:play:closed
```

These commands create an Android App Bundle and use the matching `submit` profile. To build without submitting, use:

```powershell
bun run build:play:internal
bun run build:play:beta
bun run build:play:closed
```

To submit an already-created latest build separately:

```powershell
bunx eas submit --platform android --profile internal --latest
bunx eas submit --platform android --profile beta --latest
bunx eas submit --platform android --profile closed --latest
```

## EAS Update commands

An EAS Update only changes JavaScript/assets for an installed build whose channel and runtime version match. It does not replace a native Android build or change the Play track.

```powershell
bun run update:play:internal
bun run update:play:beta
bun run update:play:closed
```

## One-time Play Console setup

Before the first submission:

1. Create the Android app in Play Console with package name `app.gemfort`.
2. Configure Play App Signing and complete the required store listing, App content, Data safety, and target-audience declarations.
3. Create the Play testers for Internal, Beta/Open, and Closed testing as needed.
4. Configure EAS Android submission credentials with a Google Play service account that has permission to manage releases for this app. Keep the service-account JSON out of the repository.
5. Submit the first release to Internal testing and confirm it is available to the intended testers before promoting or submitting to Beta/Open or Closed testing.

Play track setup and tester membership remain Play Console operations; the repository only supplies the repeatable EAS build, channel, and submit configuration.

## Versioning and production safety

The testing profiles inherit remote versioning and automatic Android version-code increments from the new `internal` store profile. Do not use `production-apk` for Play Store submission: it creates an APK for device/internal use, while Play Store submissions require an AAB.

Testing profiles intentionally use `EXPO_PUBLIC_APP_ENV=preview`. This keeps Play testing separate from the production app environment while retaining the existing application ID. Move a profile to the production environment only as an explicit release decision, after reviewing its backend and Firebase configuration.
