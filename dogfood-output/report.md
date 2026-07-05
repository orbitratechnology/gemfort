# GemFort Android Dogfood Report — Comprehensive QA

**Date:** 2026-07-05  
**Platform:** Android physical device V2321  
**Target app:** `app.gemfort.dev` (dev client)  
**Session:** `agent-device` default  
**Scope:** Guest flows, auth, signed-in workspace, edge cases (post web-removal, native-only)

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| Info | 1 |

**Overall:** Stable on Android V2321 — no crashes or RN error overlays. Guest marketplace, auth gates, and signed-in workspace all exercised.

## Post-QA fixes applied

- Removed `markOnboardingComplete()` from register flow (QA-003: new users were skipping onboarding)
- Added `testID`s on SignInPrompt and BusinessCard CTAs (QA-001 automation/a11y)

---

## What passed (25 flows)

Home guest, directory browse/search/filter, providers tab, business profile, Call/WhatsApp handoff, back navigation, Workspace/Profile guest gates (no Fabric crash), login/register/forgot-password screens, verify OTP with dev skip, signed-in workspace/gems/contacts/notifications/profile, My Business form, empty search state, tab navigation.

## Issues

### QA-001 — In-app button taps fail via `@ref` / label (Medium)

Some in-screen buttons return coordinate errors under automation. **Mitigation:** `testID`s added on auth and directory CTAs; coordinate press still works as fallback.

### QA-002 — Home pull-to-refresh inconclusive (Low)

No refresh indicator observed; may be unimplemented.

### QA-003 — Registration skipped onboarding (Low)

`markOnboardingComplete()` on register caused bypass. **Fixed** in code.

### QA-004 — Slow Android snapshots under load (Low)

~17s p95 during QA; tooling/device load, not user-facing.

### QA-005 — Search `type` vs `fill` during automation (Info)

Use `fill` on directory search field; incremental `type` can foreground system UI.

---

## Residual risk

- Production SMS OTP not tested (dev skip used)
- iOS not exercised this run
- Release-build performance not assessed
- Onboarding after register fix needs re-verification on device

## Screenshots

See `dogfood-output/screenshots/qa-*.png` (001–023 from comprehensive session).
