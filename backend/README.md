# GemFort API

> Hono.js REST backend that replaces Firebase Cloud Functions.
> Client → API → Firebase (Firestore · Auth · Storage · FCM)

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 |
| Framework | [Hono](https://hono.dev) v4 |
| Language | TypeScript 5 (ESM) |
| Validation | [Zod](https://zod.dev) |
| Firebase | firebase-admin v13 |
| AI / Scraping | Google Gemini + Firecrawl |
| API Docs | Swagger UI (`/docs`) |

---

## Quick start

```bash
cd backend
cp .env.example .env          # fill in Firebase credentials
npm install
npm run dev                   # starts on :3000 with hot reload
```

Open **http://localhost:3000/docs** for the interactive Swagger UI.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port (default `3000`) |
| `NODE_ENV` | no | `development` / `production` / `test` |
| `GOOGLE_APPLICATION_CREDENTIALS` | one of two options | Path to service-account JSON (ADC) |
| `FIREBASE_PROJECT_ID` | one of two options | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | one of two options | Service account email |
| `FIREBASE_PRIVATE_KEY` | one of two options | Service account private key |
| `FIREBASE_STORAGE_BUCKET` | no | GCS bucket (default `gemfort.firebasestorage.app`) |
| `WEBHOOK_SECRET` | yes (prod) | Shared secret for Firestore/Auth webhooks |
| `CRON_SECRET` | yes (prod) | Shared secret for cron endpoints |
| `GEMINI_API_KEY` | for news sync | Google Gemini API key |
| `FIRECRAWL_API_KEY` | for news sync | Firecrawl API key |
| `CORS_ORIGINS` | no | Comma-separated allowed origins (empty = allow all in dev) |

---

## API overview

### Authentication

All `/api/v1/*` routes require a **Firebase ID token**:

```
Authorization: Bearer <Firebase-ID-Token>
```

Webhook routes (`/webhooks/*`) use:

```
Authorization: Bearer <WEBHOOK_SECRET>
```

Cron routes (`/api/v1/admin/cron/*`) use:

```
Authorization: Bearer <CRON_SECRET>
```

### Route groups

| Group | Prefix | Auth |
|---|---|---|
| Health check | `/health` | None |
| Account | `/api/v1/account` | Firebase ID token |
| GemTrack AP | `/api/v1/gemtrack/ap` | Firebase ID token |
| Admin — news | `/api/v1/admin/news` | Firebase ID token + `admin` role |
| Admin — cron | `/api/v1/admin/cron` | `CRON_SECRET` |
| Webhooks | `/webhooks/` | `WEBHOOK_SECRET` |

---

## Endpoints

### Account

| Method | Path | Description |
|---|---|---|
| `DELETE` | `/api/v1/account` | Permanently delete authenticated user's account |

### GemTrack AP lifecycle

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/gemtrack/ap` | Create new AP consignment request |
| `POST` | `/api/v1/gemtrack/ap/:apId/respond` | Accept or reject pending AP |
| `POST` | `/api/v1/gemtrack/ap/:apId/cancel` | Cancel AP |
| `POST` | `/api/v1/gemtrack/ap/:apId/gems/:gemId/sell` | Record gem sale within AP |
| `POST` | `/api/v1/gemtrack/ap/:apId/gems/:gemId/return` | Return gem from AP |
| `POST` | `/api/v1/gemtrack/ap/:apId/payment/sent` | AP holder marks payment sent |
| `POST` | `/api/v1/gemtrack/ap/:apId/payment/received` | Owner confirms payment received |

### Admin

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/news/sync` | Trigger immediate news + exhibitions sync |
| `POST` | `/api/v1/admin/cron/daily-gemtrack-notifications` | Run daily alert checks |
| `POST` | `/api/v1/admin/cron/sync-gem-news` | Sync gem news |
| `POST` | `/api/v1/admin/cron/sync-exhibitions` | Sync exhibition events |

### Webhooks (Firestore events)

| Method | Path | Replaces Cloud Function |
|---|---|---|
| `POST` | `/webhooks/firestore/announcement-published` | `onAnnouncementPublished` |
| `POST` | `/webhooks/firestore/verification-status-changed` | `onVerificationStatusChanged` |
| `POST` | `/webhooks/firestore/report-resolved` | `onReportResolved` |
| `POST` | `/webhooks/firestore/user-account-action` | `onUserAccountAction` |
| `POST` | `/webhooks/firestore/cheque-bounced` | `onChequeBounced` |
| `POST` | `/webhooks/firestore/service-request-created` | `onServiceRequestCreated` |
| `POST` | `/webhooks/firestore/service-request-updated` | `onServiceRequestUpdated` |
| `POST` | `/webhooks/firestore/cert-request-created` | `onCertRequestCreated` |
| `POST` | `/webhooks/firestore/cert-request-updated` | `onCertRequestUpdated` |
| `POST` | `/webhooks/firestore/notification-created` | `onNotificationCreated` |
| `POST` | `/webhooks/auth/user-deleted` | `onAuthUserDeleted` |

---

## Error format

All errors return a consistent JSON shape:

```json
{
  "error": {
    "code": 400,
    "message": "Human-readable reason"
  }
}
```

---

## Scripts

```bash
npm run dev        # Development with hot reload (tsx watch)
npm run build      # Compile to dist/
npm start          # Run compiled output
npm run lint       # TypeScript type-check (tsc --noEmit)
```

---

## Project structure

```
backend/
├── src/
│   ├── app.ts                    # Hono app factory + OpenAPI spec
│   ├── index.ts                  # Node.js HTTP server entry point
│   ├── config.ts                 # Environment config
│   ├── firebase.ts               # Firebase Admin SDK singleton
│   ├── lib/
│   │   ├── errors.ts             # HTTP error helpers
│   │   └── logger.ts             # Structured JSON logger
│   ├── middleware/
│   │   ├── auth.ts               # Firebase ID token verification
│   │   ├── rbac.ts               # Role-based access control
│   │   └── webhook-guard.ts      # Shared-secret guard for webhooks/cron
│   ├── services/
│   │   ├── account/
│   │   │   └── wipe-user-data.ts
│   │   ├── gemtrack/
│   │   │   ├── ap-lifecycle.ts
│   │   │   └── gemtrack-checks.ts
│   │   ├── news/
│   │   │   ├── firecrawl.ts
│   │   │   ├── gemini.ts
│   │   │   ├── retry.ts
│   │   │   ├── schemas.ts
│   │   │   ├── sources.ts
│   │   │   ├── sync-gem-news.ts
│   │   │   └── sync-exhibitions.ts
│   │   └── notifications/
│   │       ├── create.ts
│   │       ├── push.ts
│   │       └── types.ts
│   └── routes/
│       ├── health.ts
│       ├── account.ts
│       ├── gemtrack/
│       │   └── ap.ts
│       ├── admin/
│       │   ├── news.ts
│       │   └── cron.ts
│       └── webhooks/
│           ├── firestore.ts
│           └── auth.ts
├── docs/
│   └── GUIDE.md
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Deployment

See [`docs/GUIDE.md`](docs/GUIDE.md) for:
- Firebase service account setup
- Cloud Run / Railway / Render deployment
- Connecting Firestore triggers to webhook endpoints
- Setting up cron jobs with Cloud Scheduler
- Security hardening checklist
