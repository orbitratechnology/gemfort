# Template Setup Guide (Expo 57 + Firebase)

## 1) Replace all project placeholders

Update these files first:

- `/home/runner/work/gemfort/gemfort/.env`
- `/home/runner/work/gemfort/gemfort/.firebaserc`
- `/home/runner/work/gemfort/gemfort/google-services/google-services.json`
- `/home/runner/work/gemfort/gemfort/google-services/google-services.dev.json`
- `/home/runner/work/gemfort/gemfort/google-services/google-services.preview.json`
- `/home/runner/work/gemfort/gemfort/google-services/GoogleService-Info.plist`
- `/home/runner/work/gemfort/gemfort/google-services/GoogleService-Info.dev.plist`
- `/home/runner/work/gemfort/gemfort/google-services/GoogleService-Info.preview.plist`

## 2) App identity and environments

Set the following in `.env`:

- `EXPO_PUBLIC_APP_NAME`
- `EXPO_PUBLIC_APP_SLUG`
- `EXPO_PUBLIC_APP_SCHEME`
- `EXPO_PUBLIC_BUNDLE_ID_BASE`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_ASSOCIATED_DOMAIN` (optional)

`app.config.ts` automatically maps package identifiers by environment:

- development -> `<bundle>.dev`
- preview -> `<bundle>.preview`
- production -> `<bundle>`

## 3) Firebase essentials

- Enable Authentication providers required by your app.
- Create Firestore indexes from `firestore.indexes.json`.
- Review and harden `firestore.rules` and `storage.rules`.
- Configure Cloud Functions environment and deploy.

## 4) High-performance defaults

- React Query for server/cache state
- Expo Router typed routes enabled
- React Compiler experiment enabled
- Static iOS frameworks for RN Firebase via `expo-build-properties`

## 5) Security defaults

- No secrets committed in source files
- Keep `.env` local only
- Use Firebase Rules as first security boundary
- Run secret scan before each commit
- Run CodeQL check before release

## 6) Agent, skills, and IDE setup

Preserve and adapt:

- `/home/runner/work/gemfort/gemfort/.agents`
- `/home/runner/work/gemfort/gemfort/.claude`
- `/home/runner/work/gemfort/gemfort/.cursor`
- `/home/runner/work/gemfort/gemfort/.vscode`
- `/home/runner/work/gemfort/gemfort/skills-lock.json`

These keep agent behavior, skills, and editor tooling consistent.

## 7) Cloud Functions starter flow

- Place domain-specific functions in `functions/src/<feature>/`.
- Keep shared utilities in `functions/src/config.ts` and `functions/src/admin.ts`.
- Export functions from `functions/src/index.ts` only.

## 8) Validation checklist

Run before opening a PR:

```bash
bun run lint
bun run typecheck
bun run test
npm --prefix functions run build
npm --prefix functions run test
```

## 9) Recommended first cleanup for a new product

- Replace existing domain feature names under `src/features/`.
- Remove business-specific scripts you do not need under `scripts/`.
- Rename app package in `package.json` and `functions/package.json`.
- Replace visual identity in `assets/`.
