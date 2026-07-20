# GemFort

Mobile platform for the gemstone trade (iOS + Android).

## Project overview

**GemFort** pairs a verified trust network (GemNet) with private business operations (GemTrack) built for how gem dealers actually work: AP stones, post-dated cheques, sourcing trips, lab certificates, and WhatsApp-first deals.

| | |
|---|---|
| Mobile stack | Expo SDK 57 · React Native · Firebase |
| Backend | Hono.js REST API (Node 22) — see `backend/` |
| Firebase | Firestore · Auth · Storage · FCM |
| Owner | orbitratech |

## Structure

```
/                 Expo mobile app (iOS + Android)
backend/          Hono.js REST API replacing Firebase Cloud Functions
functions/        Original Firebase Cloud Functions (reference)
plan/             Internal product documentation
```

## Backend (Hono.js API)

The `backend/` directory contains a complete REST API built with Hono.js that replaces all Firebase Cloud Functions. See `backend/README.md` for full documentation and `backend/docs/GUIDE.md` for deployment and integration instructions.

### Running the backend locally

```bash
cd backend
cp .env.example .env   # fill in Firebase credentials
npm install
npm run dev            # starts on :3000
# → http://localhost:3000/docs (Swagger UI)
```

### Running the mobile app

The mobile app requires native iOS or Android builds via EAS — it cannot be previewed in a browser. Use EAS CLI to build and run on a device or simulator:

```bash
npm install
eas build --profile development --platform ios   # or android
```

## User preferences

- Keep existing project structure — do not reorganise or migrate without asking.
- Backend must follow OpenAPI spec strictly.
- All secrets via environment variables, never hardcoded.
