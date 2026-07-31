# Expo 57 + React Native + Firebase Template

Production-ready starter template for Android and iOS using:

- Expo SDK 57
- React Native 0.86
- React 19
- Firebase (Auth, Firestore, Storage, Cloud Functions)
- TypeScript, Expo Router, React Query, Zod

This repository is now template-first: replace placeholders, plug in your Firebase project, and start building features with a scalable structure.

## What is included

- Expo app config with environment-driven placeholders (`app.config.ts`)
- Firebase native config placeholders (`google-services/*`)
- `.env.example` with all required setup variables
- Firestore / Storage rules + indexes + Functions starter
- AI/agent setup files for Claude/Cursor/VS Code (`.agents`, `.claude`, `.cursor`, `.vscode`)
- Type-safe project setup (ESLint, Jest, TypeScript)
- Feature-first app folder organization under `src/features`

## Quick start

1. Install dependencies

```bash
bun install
npm --prefix functions install
```

2. Create your local environment file

```bash
cp .env.example .env
```

3. Replace all placeholder values in:

- `.env`
- `.firebaserc`
- `google-services/*.json`
- `google-services/*.plist`

4. Start the app

```bash
bun start
```

5. Run quality checks

```bash
bun run lint
bun run typecheck
bun run test
npm --prefix functions run build
npm --prefix functions run test
```

## Scalable feature structure

Use a feature-wise structure so each feature is isolated and easy to extend:

```text
src/
  app/                  # Expo Router routes/layouts
  features/
    auth/
      components/
      hooks/
      services/
      screens/
      types/
    marketplace/
    workspace/
    _template/          # Copy this as a base for new features
  components/           # Cross-feature UI primitives
  lib/                  # Shared libs (firebase, api clients)
  providers/            # App-wide providers
  constants/            # Global constants and tokens
```

## Firebase setup

- Keep a single Firebase project or separate projects per environment.
- Configure Firestore/Storage rules before launch.
- Deploy backend artifacts:

```bash
bun run firebase:deploy
```

## Template setup guide

See `/home/runner/work/gemfort/gemfort/TEMPLATE_SETUP.md` for full setup, conventions, security defaults, and launch checklist.

## AI/Agent-friendly workflow

This repo includes:

- `.agents/skills` for reusable task guidance
- `.claude/settings.json` for MCP plugin config
- `.cursor/settings.json` and `.vscode/settings.json` for editor automation
- `AGENTS.md` with Expo 57 rule alignment

Keep these files in your derived project so agents stay consistent across teams and IDEs.
