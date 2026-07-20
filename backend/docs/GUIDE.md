# GemFort API — Integration & Deployment Guide

This guide covers everything needed to replace Firebase Cloud Functions with the
GemFort Hono.js API in a production environment.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Firebase setup](#2-firebase-setup)
3. [Running locally](#3-running-locally)
4. [Deploying to Cloud Run](#4-deploying-to-cloud-run)
5. [Connecting Firestore triggers to webhooks](#5-connecting-firestore-triggers-to-webhooks)
6. [Setting up cron jobs](#6-setting-up-cron-jobs)
7. [Updating the mobile client](#7-updating-the-mobile-client)
8. [Security hardening checklist](#8-security-hardening-checklist)
9. [Monitoring & observability](#9-monitoring--observability)
10. [Rollback plan](#10-rollback-plan)

---

## 1. Architecture overview

```
Mobile App (Expo / React Native)
    │
    │  Firebase ID Token (Authorization: Bearer)
    ▼
GemFort API  (Hono.js — Node 22)
    │
    ├── Firebase Admin SDK ──► Firestore
    │                    ──► Firebase Auth
    │                    ──► Firebase Storage
    │                    ──► FCM (push notifications)
    │
    └── External APIs ──► Firecrawl (web scraping)
                    ──► Google Gemini (AI extraction)

Firestore event triggers  ──► Webhook endpoints  (WEBHOOK_SECRET)
Cloud Scheduler / cron    ──► Cron endpoints     (CRON_SECRET)
```

**Key differences from Cloud Functions:**

| Cloud Functions | Hono API |
|---|---|
| Callable functions (`onCall`) | REST endpoints (`POST /api/v1/...`) |
| Firestore triggers (`onDocumentCreated`) | Webhook endpoints (`POST /webhooks/...`) |
| Scheduled functions (`onSchedule`) | Cron endpoints + external scheduler |
| Firebase-managed deployment | Self-managed (Cloud Run, Railway, etc.) |

---

## 2. Firebase setup

### 2.1 Service account

1. Go to **Firebase Console → Project Settings → Service accounts**.
2. Click **Generate new private key** and download the JSON file.
3. Either:
   - Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`, or
   - Extract the three values and set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

> **Never commit the service account file.** Add it to `.gitignore`.

### 2.2 Required Firebase permissions

The service account needs these IAM roles:
- `Firebase Admin` (includes Firestore, Storage, Auth)
- `Cloud Messaging Admin` (for FCM push)

Or use the principle of least privilege:
- `roles/datastore.user`
- `roles/storage.objectAdmin`
- `roles/firebaseauth.admin`
- `roles/cloudmessaging.admin`

### 2.3 Firestore indexes

The existing `firestore.indexes.json` covers all queries used by this API.
Deploy indexes before going live:

```bash
firebase deploy --only firestore:indexes
```

---

## 3. Running locally

```bash
cd backend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env
# Edit .env — at minimum set GOOGLE_APPLICATION_CREDENTIALS or
# FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY

# Start with hot reload
npm run dev
```

**Verify it works:**

```bash
# Health check
curl http://localhost:3000/health

# API docs
open http://localhost:3000/docs
```

---

## 4. Deploying to Cloud Run

Cloud Run is the recommended host — it auto-scales to zero, runs in the same
GCP project as Firebase, and supports IAM-based service accounts.

### 4.1 Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 4.2 Deploy command

```bash
gcloud run deploy gemfort-api \
  --source . \
  --region asia-south1 \
  --project gemfort \
  --allow-unauthenticated \
  --service-account gemfort-api@gemfort.iam.gserviceaccount.com \
  --set-env-vars "NODE_ENV=production,FIREBASE_STORAGE_BUCKET=gemfort.firebasestorage.app" \
  --set-secrets "WEBHOOK_SECRET=gemfort-webhook-secret:latest,CRON_SECRET=gemfort-cron-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,FIRECRAWL_API_KEY=firecrawl-api-key:latest"
```

> Store secrets in **Google Secret Manager** and reference them with `--set-secrets`.

When deployed on Cloud Run with a GCP service account, ADC (Application Default
Credentials) is used automatically — no `GOOGLE_APPLICATION_CREDENTIALS` needed.

### 4.3 Set `CORS_ORIGINS`

```bash
gcloud run services update gemfort-api \
  --update-env-vars "CORS_ORIGINS=https://gemfort.app,https://admin.gemfort.app"
```

---

## 5. Connecting Firestore triggers to webhooks

Cloud Functions Firestore triggers are replaced by **Eventarc + webhook calls**.
Set up one Cloud Functions trigger per collection (or use a thin Cloud Function
that just POSTs to the API):

### Option A — Thin forwarding Cloud Function (easiest migration)

Keep a minimal Cloud Function that forwards events to the API:

```typescript
// functions/src/forwarder.ts
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { fetch } from 'undici';

const API_BASE = process.env.GEMFORT_API_URL; // https://api.gemfort.app
const SECRET   = process.env.WEBHOOK_SECRET;

async function post(path: string, body: object) {
  await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  });
}

export const onNotificationCreatedFwd = onDocumentCreated(
  'notifications/{id}',
  async (event) => {
    await post('/webhooks/firestore/notification-created', {
      documentId: event.params.id,
      data: event.data?.data() ?? {},
    });
  },
);

// ... add one export per trigger
```

### Option B — Google Cloud Eventarc (fully serverless)

1. Create an Eventarc trigger for each Firestore collection change.
2. Set the trigger destination to the API URL.
3. Add a service account with `roles/run.invoker`.

See [Eventarc Firestore docs](https://cloud.google.com/eventarc/docs/run/create-trigger-firestore-gcloud).

### Webhook payload format

**Created events:**
```json
{
  "documentId": "abc123",
  "data": { /* document fields */ }
}
```

**Updated events:**
```json
{
  "documentId": "abc123",
  "before": { /* previous fields */ },
  "after": { /* new fields */ }
}
```

### Webhook endpoints summary

| Firestore collection | Event | Endpoint |
|---|---|---|
| `announcements` | created | `POST /webhooks/firestore/announcement-published` |
| `verification_applications` | updated | `POST /webhooks/firestore/verification-status-changed` |
| `reports` | updated | `POST /webhooks/firestore/report-resolved` |
| `users` | updated | `POST /webhooks/firestore/user-account-action` |
| `gemtrack_cheques` | updated | `POST /webhooks/firestore/cheque-bounced` |
| `service_requests` | created | `POST /webhooks/firestore/service-request-created` |
| `service_requests` | updated | `POST /webhooks/firestore/service-request-updated` |
| `certification_requests` | created | `POST /webhooks/firestore/cert-request-created` |
| `certification_requests` | updated | `POST /webhooks/firestore/cert-request-updated` |
| `notifications` | created | `POST /webhooks/firestore/notification-created` |
| Firebase Auth | user deleted | `POST /webhooks/auth/user-deleted` |

---

## 6. Setting up cron jobs

### Cloud Scheduler

```bash
# Daily GemTrack notifications — 08:00 Asia/Colombo
gcloud scheduler jobs create http gemfort-daily-gemtrack \
  --location asia-south1 \
  --schedule "0 8 * * *" \
  --time-zone "Asia/Colombo" \
  --uri "https://api.gemfort.app/api/v1/admin/cron/daily-gemtrack-notifications" \
  --http-method POST \
  --headers "Authorization=Bearer ${CRON_SECRET},Content-Type=application/json"

# News sync — every 6 hours
gcloud scheduler jobs create http gemfort-sync-news \
  --location asia-south1 \
  --schedule "0 */6 * * *" \
  --time-zone "UTC" \
  --uri "https://api.gemfort.app/api/v1/admin/cron/sync-gem-news" \
  --http-method POST \
  --headers "Authorization=Bearer ${CRON_SECRET},Content-Type=application/json"

# Exhibition sync — daily at midnight Colombo
gcloud scheduler jobs create http gemfort-sync-exhibitions \
  --location asia-south1 \
  --schedule "0 0 * * *" \
  --time-zone "Asia/Colombo" \
  --uri "https://api.gemfort.app/api/v1/admin/cron/sync-exhibitions" \
  --http-method POST \
  --headers "Authorization=Bearer ${CRON_SECRET},Content-Type=application/json"
```

### Alternative: cron-job.org

Use [cron-job.org](https://cron-job.org) or any HTTP-based scheduler with the same URL + header.

---

## 7. Updating the mobile client

Replace Firebase callable function invocations with REST API calls.

### Before (Firebase callable)

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'asia-south1');
const createAp = httpsCallable(functions, 'createApRequest');
const result = await createAp({ receiverContactId: '...', items: [...] });
```

### After (REST API)

```typescript
import auth from '@react-native-firebase/auth';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth().currentUser?.getIdToken();
  const res = await fetch(`https://api.gemfort.app${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// Create AP request
const result = await apiFetch('/api/v1/gemtrack/ap', {
  method: 'POST',
  body: JSON.stringify({ receiverContactId: '...', items: [...] }),
});
```

### Token refresh

Firebase ID tokens expire after 1 hour. Use `getIdToken(/* forceRefresh */ true)`
or always use `getIdToken()` which automatically refreshes when needed.

---

## 8. Security hardening checklist

- [ ] `WEBHOOK_SECRET` is a cryptographically random hex string (≥ 32 bytes).
  ```bash
  openssl rand -hex 32
  ```
- [ ] `CRON_SECRET` is a separate cryptographically random hex string.
- [ ] `CORS_ORIGINS` is set to your exact production domains in production.
- [ ] Service account has only the minimum required IAM roles.
- [ ] The API is deployed behind HTTPS only (Cloud Run enforces this).
- [ ] Firestore security rules are still in place as a defence-in-depth layer.
- [ ] `NODE_ENV=production` is set in the production environment.
- [ ] The Swagger UI (`/docs`) is not accessible in production (it is disabled
      automatically when `NODE_ENV=production`).
- [ ] Rate limiting is applied at the load balancer / Cloud Run ingress level.
- [ ] Secrets are stored in Google Secret Manager, not in environment files.
- [ ] The service account key JSON is never committed to version control.

---

## 9. Monitoring & observability

### Structured logs

The logger emits JSON in production, compatible with **Cloud Logging**:

```json
{ "severity": "INFO", "message": "AP created", "apId": "abc", "uid": "xyz", "timestamp": "..." }
```

### Health check

```bash
curl https://api.gemfort.app/health
# → { "ok": true, "service": "gemfort-api", "version": "1.0.0" }
```

Set up an uptime monitor (Cloud Monitoring, Datadog, Better Uptime) on `/health`.

### Server-Timing header

Every response includes a `Server-Timing` header with total request duration.
Use this with browser DevTools or APM tools to profile latency.

### Cloud Run metrics

Cloud Run automatically surfaces:
- Request count, latency, and error rates
- Container CPU and memory usage
- Cold start frequency

---

## 10. Rollback plan

If issues arise after deploying the API:

1. **Keep the Cloud Functions deployed** during the migration period.
2. In the mobile app, use a feature flag or `EXPO_PUBLIC_APP_ENV` to choose
   between the callable API and the REST API.
3. If the REST API fails, flip the flag back to Cloud Functions — no Firestore
   schema changes are required.
4. Fix the issue in the API, redeploy, and flip the flag again.

### Gradual migration

Migrate one feature group at a time:
1. Start with read-only endpoints (health check, news sync).
2. Move AP lifecycle (most complex, most impactful).
3. Move account deletion.
4. Move webhooks (requires Eventarc or forwarding functions).
5. Remove Cloud Functions once all webhooks are validated.
