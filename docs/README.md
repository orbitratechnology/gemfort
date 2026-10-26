# GemFort docs

This folder holds every GemFort doc other than the root [`README.md`](../README.md), grouped by purpose. Start here.

## The rule

**Each artifact has one canonical source. Code and config win over prose.**

- If a doc disagrees with the code or config, the code is right and the doc is stale: fix or delete the doc.
- Prose never copies [`firestore.rules`](../firestore.rules), [`firestore.indexes.json`](../firestore.indexes.json) or [`app.config.ts`](../app.config.ts). Link to the file, or to a specific rule or section in it, instead.
- When a doc stops being true but is worth keeping, move it to [`history/`](history/) rather than leaving it next to current docs.

## Where the truth lives

| Information | Source of truth | Not this |
|---|---|---|
| Firestore access control | [`firestore.rules`](../firestore.rules) | `plan/07-security-rules.md` (stale copy, pending deletion) |
| Firestore data model and queries | [`firestore.rules`](../firestore.rules), [`firestore.indexes.json`](../firestore.indexes.json), the types in [`src/types/`](../src/types/) | `plan/06-firestore-schema.md` (documents the dead `company_*` model, pending deletion) |
| Storage access control | [`storage.rules`](../storage.rules) | — |
| App identity, plugins, build-time env | [`app.config.ts`](../app.config.ts), [`eas.json`](../eas.json) | — |
| Firebase deploy targets | [`firebase.json`](../firebase.json), [`.firebaserc`](../.firebaserc) | — |
| Deployed Cloud Functions | [`functions/src/index.ts`](../functions/src/index.ts) | — |
| HTTP API routes (`gemfortApi`, Hono) | [`functions/src/api/`](../functions/src/api/) | [`architecture/phase-1-api-contract.md`](architecture/phase-1-api-contract.md) (design-time contract) |
| Design tokens and theme | [`src/constants/design-tokens.ts`](../src/constants/design-tokens.ts), [`src/constants/theme.ts`](../src/constants/theme.ts) | [`product/12-design-system.md`](product/12-design-system.md) (original intent) |
| Brand copy | [`src/constants/brand-story.ts`](../src/constants/brand-story.ts) | — |
| Published Terms and Privacy Policy | [orbitratech.net/gemfort/terms-and-conditions](https://www.orbitratech.net/gemfort/terms-and-conditions), [orbitratech.net/gemfort/privacy-policy](https://www.orbitratech.net/gemfort/privacy-policy) (linked from [`src/constants/legal.ts`](../src/constants/legal.ts)) | [`legal/`](legal/) (older drafts) |
| Why the backend is shaped as it is | [`architecture/adr-001-gemfort-api-consolidation.md`](architecture/adr-001-gemfort-api-consolidation.md) | — |
| Product intent and scope | [`product/02-prd.md`](product/02-prd.md) | — |
| Hono framework | [hono.dev](https://hono.dev) | a local copy of its docs (removed) |
| Expo SDK APIs | [docs.expo.dev/versions/v57.0.0](https://docs.expo.dev/versions/v57.0.0/) | — |

## Index

Status key: **Current** = maintained and expected to match the code. **Reference** = original spec. It records intent, may lag the code, and loses to the code wherever the two disagree. **Historical** = a record of past work; don't update it. **Draft** = not the published version.

### [`product/`](product/): product specs (January 2025 suite)

| Doc | Status |
|---|---|
| [`00-contents.md`](product/00-contents.md) | Historical: the suite's original index. It still lists 06, 07 and 13, which are not in this folder (see *Pending decision*). |
| [`02-prd.md`](product/02-prd.md) | Reference |
| [`03-user-roles.md`](product/03-user-roles.md) | Reference |
| [`04-navigation.md`](product/04-navigation.md) | Reference |
| [`05-screen-specifications.md`](product/05-screen-specifications.md) | Reference |
| [`08-ranking-algorithm.md`](product/08-ranking-algorithm.md) | Reference |
| [`09-search-and-filtering.md`](product/09-search-and-filtering.md) | Reference |
| [`10-notifications.md`](product/10-notifications.md) | Reference (cited by `functions/src/gemtrack/daily.ts`) |
| [`11-admin-panel.md`](product/11-admin-panel.md) | Reference |
| [`12-design-system.md`](product/12-design-system.md) | Reference: tokens in code win |
| [`14-acceptance-criteria.md`](product/14-acceptance-criteria.md) | Reference |

### [`architecture/`](architecture/): backend decisions and migration

| Doc | Status |
|---|---|
| [`adr-001-gemfort-api-consolidation.md`](architecture/adr-001-gemfort-api-consolidation.md) | Current: accepted decision to consolidate callables into one Hono HTTP function |
| [`phase-0-backend-migration-baseline.md`](architecture/phase-0-backend-migration-baseline.md) | Historical: read-only baseline, August 2026 |
| [`phase-1-api-contract.md`](architecture/phase-1-api-contract.md) | Historical. **Outdated status line:** it says "nothing deployed", but the Hono API (`gemfortApi`) is live and exported from [`functions/src/index.ts`](../functions/src/index.ts). Read it as the design-time contract only. |
| [`phase-2-hono-shell.md`](architecture/phase-2-hono-shell.md) | Historical |
| [`phase-3-client-canary.md`](architecture/phase-3-client-canary.md) | Historical |
| [`phase-4-app-check-canary.md`](architecture/phase-4-app-check-canary.md) | Historical |

### [`security/`](security/)

| Doc | Status |
|---|---|
| [`legal-and-security-audit.md`](security/legal-and-security-audit.md) | Historical: a snapshot of the audit on 15 September 2026. Findings may have been fixed since; check the code. |

### [`legal/`](legal/)

| Doc | Status |
|---|---|
| [`privacy-policy.md`](legal/privacy-policy.md) | Draft. **The published version at [orbitratech.net/gemfort/privacy-policy](https://www.orbitratech.net/gemfort/privacy-policy) is newer.** Don't treat this copy as what users agreed to. |
| [`terms-and-conditions.md`](legal/terms-and-conditions.md) | Draft. **The published version at [orbitratech.net/gemfort/terms-and-conditions](https://www.orbitratech.net/gemfort/terms-and-conditions) is newer.** |

### [`ops/`](ops/): runbooks and account setup

| Doc | Status |
|---|---|
| [`PLAY_STORE_TRACKS.md`](ops/PLAY_STORE_TRACKS.md) | Current: Play testing tracks, EAS profiles and channels |
| [`GOOGLE_SERVICES_EAS.md`](ops/GOOGLE_SERVICES_EAS.md) | Current: Firebase native config through EAS file variables |
| [`GOOGLE_AUTH_HANDOFF.md`](ops/GOOGLE_AUTH_HANDOFF.md) | Current: Google and Apple sign-in steps that need the account owner |
| [`TRAVELPAYOUTS_SETUP.md`](ops/TRAVELPAYOUTS_SETUP.md) | Current: Flights secrets in Secret Manager |

### [`history/`](history/): completed work logs

| Doc | Status |
|---|---|
| [`executor-plans/`](history/executor-plans/README.md) | Historical: animation-audit executor plans 001–005 and the Bills plan 006, all DONE |
| [`phone-auth-fixes.md`](history/phone-auth-fixes.md) | Historical: phone-auth hardening notes. Phone auth has since been removed from the app. |
| [`phone-auth-sms-debug.md`](history/phone-auth-sms-debug.md) | Historical: SMS-delivery debugging notes. It starts mid-document and was formerly the root file `.md`. |

## Pending decision

These three files are still in [`plan/`](../plan/) until the owner decides what to do with them:

| File | Problem | Recommendation |
|---|---|---|
| `plan/06-firestore-schema.md` | Still documents the dead `company_*` model | Delete. The rules and indexes are the source of truth. |
| `plan/07-security-rules.md` | A stale 483-line copy of `firestore.rules` | Delete |
| `plan/13-development-roadmap.md` | Describes a Flutter app that was never built | Delete, or move to `history/` stamped "SUPERSEDED — Flutter, never built" |

[`src/constants/transaction-categories.ts`](../src/constants/transaction-categories.ts) cites `plan/06-firestore-schema.md` for the transaction category taxonomy. Repoint or drop that comment when 06 goes.
