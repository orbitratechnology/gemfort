# NOTIFICATIONS.md
## Notification System

### Request / certificate types

```
  service_request_received     → lapidary (on create)
  service_request_accepted     → trader
  service_request_rejected     → trader
  service_job_updated          → trader
  cert_request_received        → gem lab
  cert_request_accepted        → trader
  cert_request_rejected        → trader
  cert_ready                   → trader (certificate published)
```

Implemented in `functions/src/gemnet/requests.ts` and client `createClientNotification` (rules-gated).

### Existing types (unchanged)

Verification, announcements, reports, account actions, cheque/AP/payment/service overdue — see prior GemNet/GemTrack sections in git history / `functions/src/notifications/types.ts`.
