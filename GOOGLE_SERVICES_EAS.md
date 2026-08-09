# Firebase native config sync

Firebase has one project with separate Android and iOS apps for each EAS environment:

- `development` → `app.gemfort.dev`
- `preview` → `app.gemfort.preview`
- `production` → `app.gemfort`

The native files are intentionally ignored by git. `app.config.ts` uses EAS file environment variables when they are present and falls back to the matching local files for local native builds.

## Refresh local files

Run this after changing Firebase apps, OAuth fingerprints, or bundle/package IDs:

```bash
bun run firebase:sync
```

To refresh only one environment:

```bash
node scripts/sync-firebase-native-configs.mjs preview
```

## Refresh EAS securely

Run this from authenticated Firebase CLI and EAS CLI sessions:

```bash
bun run firebase:sync:eas
```

The script discovers app IDs with Firebase CLI, downloads the current configs, and uploads them to the matching EAS environment as `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_PLIST` sensitive file variables. No service files are committed to git.

After changing native config, create a new EAS build; an OTA update cannot change native Firebase configuration.
