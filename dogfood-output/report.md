# GemFort role-based device QA report

**Date:** 2026-07-31 → 2026-08-01  
**Mode:** 1B Dev client + local Metro (WIP) · 2A safe Firebase (`qa-*` only)  
**Device:** Android V2321 · `app.gemfort.dev`  
**Sessions:** `gemfort-qa`, `gemfort-qa2`, `qa`  
**Seeds:** `bun run seed:qa` · password `QaTest123!`

## Verdict

Role gating and guest auth gates are solid after fixes. Full trader→trader AP lifecycle verified: give → accept → sell → pay owner → payment received (`done`) using `qa-trader-b`. Create trip P0 (`cashCarried` schema) fixed earlier this pass.

## Fixes shipped this pass

| Issue | Severity | Fix |
| --- | --- | --- |
| Guest could open Money + Cheques/Add Cheque | P0 | `SignInPrompt` in workspace/money layouts + `ap/add`, `cheques/add`, `ap/sell` |
| Guest Home showed trader banners (cheques / Give AP) | P1 | Carousel filter for guests |
| Lapidary/Lab still saw trader banners when signed in | P1 | `roles: ['trader','admin']` on cheques/AP slides + `resolveProfileRole` filter in `home-banner-carousel.tsx` |
| Workspace Gems tile `0` while hero showed 1 gem | P1 | Count active (non-terminal) inventory on workspace index |
| Mid-AP `auth/user-token-expired` after seed reset | P1 (ops) | Softer copy in `src/lib/errors.ts`; avoid reseeding while logged in |
| Create trip always failed validation (`cashCarried` Required) | P0 | Removed unused `cashCarried` from `addTripSchema`; clearer auth/type toasts on submit |
| No second QA trader for AP accept/sell | Seed gap | Added `qa-trader-b@gemfort.test` / QA Farook Gems to `scripts/seed-qa.mjs` |

## Persona evidence

### Guest
- Home: **Banner 1 of 2** (verify + market only)
- Money / Workspace → Sign In prompt
- Cert verify `GF-2026-0001` works
- Suspended login shows lockout reason

### Trader (`qa-trader@gemfort.test`)
- Workspace: Gems / AP / Trips / Cheques / Bills / Contacts
- Gems tile shows **1**; archive empty path OK
- Cheque detail + Add Cheque Direction OK
- **Give AP** → cancelled Ayyash pending, then gave to **QA Farook Gems** (`018vtsQzhfVMj4XfKwfp`)
- **Bill** To pay Rs 5,000 → QA Broker Ravi saved (Open / due 7d)
- **Trip** QA Ratnapura (Sourcing) → `gemtrack_trips/Kw9kP9Uov7xZHFZsPtia` Planning

### Trader B (`qa-trader-b@gemfort.test`) — QA Trader Farook
- Taken AP pending from Mahesh → **Accept** → status Accepted / AGREED Rs 150,000
- **Sell** wizard: owner Rs 150,000 + keep Rs 10,000 = sold Rs 160,000 → Confirm sale
- **Pay owner** cash Rs 150,000 → Firestore `payment_sent` (double-tap on Payment Sent: first wins, no duplicate error)
- Screenshots: `ap-accepted.png`, `ap-sold.png`, `ap-payment-sent.png`

### AP settlement (Mahesh confirms)
- Needs attention: **Confirm AP payment** from Farook → **Payment Received** (cash)
- Firestore `018vtsQzhfVMj4XfKwfp` → `done`; UI: “Payment received. Money ledgers updated on both sides.” + Delete AP
- Screenshot: `ap-settled-done.png`

### Lapidary (`qa-lapidary@gemfort.test`)
- Workspace: Jobs / Services / Bills / Contacts (no Gems/AP trader stack)
- Home after banner fix: **Banner 1 of 2** (no Give AP / cheques)

### Lab (`qa-lab@gemfort.test`) — session `qa`
- Profile: **QA Lab Nisha, Gem Lab**
- Home: **Banner 1 of 2**; quick actions Verify + Certificates
- Workspace: Certificates published **1**; Add certificate; Verify — no trader modules
- Certificates list: `GF-2026-0001` · Blue Sapphire 2.14ct
- Money: cashflow / payments UI loads (Rs 0.00 period)
- Screenshots: `dogfood-output/screenshots/lab-certificates.png`, `lab-home-banners.png`

## Contained chaos
- Tab switches Home ↔ Workspace ↔ Money under lab: stable; no crash
- Double-submit on **Payment Sent** / **Payment Received**: first tap applies; second gets stale UI (no double ledger)
- Stale `agent-device` refs common on slow Android snapshots — re-snapshot between presses

## Fixes (continued)
| Issue | Severity | Fix |
| --- | --- | --- |
| Workspace Trips tile ignored Planning trips (`0` while trip exists) | P2 | Count `planning` + `ongoing` as active on workspace index |

## Contained chaos (continued)
- Wireless ADB blip recovered via mDNS; Metro reload restored app after black “Loading from 172.20.10.5:8081” screen
- **Trips** tile retest: **Trips, 1** (Planning QA Ratnapura) after active-count fix

## Offline matrix (USB ADB retry — 2026-08-01)
- USB serial `10BDCB2ENQ000CH` / device `V2321`; sessions `gemfort-usb`, `gemfort-usb2`, `gemfort-off`
- Online reopen: Mahesh home OK (`usb-reopen.png`)
- **Wi‑Fi-only off is not offline** — 5G still up; Verify `GF-2026-0001` still succeeds (`verify-offline-usb.png`)
- **True offline:** `cmd connectivity airplane-mode enable` works on this OEM (broadcast path still denied). Ping unreachable; USB ADB stays up
- Airplane + Verify same cert: **cached result still shows** CERTIFICATE + Open file (`verify-true-offline-usb.png`) — Firestore persistence / prior fetch; not a fresh network round-trip
- Workspace still loads from cache offline (Gems 0 / Trips 1 after sale)
- Write-mutation error toast **not captured**: Bill Direction sheet opened offline, but `agent-device` Android snapshot helper repeatedly **adb timed out (30s)** under airplane / heavy settle; recovered with `adb kill-server` (USB only — wireless was off)
- Network restored: airplane off, Wi‑Fi `Bilal_Ibn_Suhair`, ping OK
- Tooling note: prefer short press + screenshot (avoid pile-on `snapshot -i` under airplane); PowerShell strips unescaped `label="…"` quotes — use `@eN` refs

## Offline write UX (USB, closed)
- Prepared Add Bill online/offline form: **Rs 2,000** → **Ayyash Ahamed**; airplane confirmed (`ping` unreachable)
- Save while airplane-on: **“Adding bill…”** spinner at **5s** and still at **25s** — no error toast, no timeout (`mut-save-offline-5s.png`, `mut-save-offline-25s.png`)
- After airplane off: write **completes** → bill detail **Rs 2,000.00** You owe Ayyash (`mut-save-after-reconnect.png`)
- Earlier short offline save (Rs 1,000 → Farook) same pattern: spinner during offline, success after reconnect
- **Finding (P1 / UX):** offline mutations hang on blocking spinner instead of failing fast with a retryable error; reconnect silently finishes the write

## Offline residual
1. **Offline-first:** `local-write` helpers + workspace/money/trips/services/contacts. **AP lifecycle** moved client-side (rules deployed) with `currentApId` gem locks; CF callables no longer used from app. Gem photos: save gem offline if Storage upload fails. FX: cache-only `getDocFromCache` + clear offline error.

## Personas (password `QaTest123!`)
- `qa-trader@gemfort.test` — Mahesh / QA Beruwala Sapphire House
- `qa-trader-b@gemfort.test` — Farook / QA Farook Gems (AP holder)
- `qa-lapidary@gemfort.test` · `qa-lab@gemfort.test` · `qa-suspended@gemfort.test`
