# GemFort Dogfood Report

- **Date:** 2026-08-02
- **Platform:** Android (V2321, wireless ADB)
- **App:** `app.gemfort.dev` (Expo dev client + Metro)
- **Session:** `gem-qa` (+ adb fallback when agent-device text/picker hung)
- **Scope:** Continue QA after offline-first + optional gem photos + Edit Gem formSheet

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 (fixed + retested) |
| Medium | 1 (tooling) |
| Low | 0 open (2 fixed earlier) |

## Fixes applied

### HIGH-001 — Edit gem photo upload race wiped `photoUrls` — **FIXED + RETESTED**
- **Found:** 8s `Promise.race` abandoned Storage upload and wrote `photoUrls: []`.
- **Fix:** Await up to 45s; keep remote/previous URLs on timeout; background `queueGemPhotoUrls` when upload finishes.
- **Retest pass:** Edit QANoPhoto1 → Add photos → Save → Firestore `photoUrls[0]` =
  `https://firebasestorage.googleapis.com/.../1785678250659_0.png?...`
  (`gemtrack_gems/tQr1ibbg5R219ylsOi9E`, `updatedAt` 2026-08-02T13:44:16Z)
- **Evidence:** `61`–`65` + Firebase MCP

### LOW-001 — Post-save Loading flash
- Seed `queryClient.setQueryData(["gem", gem.id], gem)` before navigate from Add gem / trip purchase.

### LOW-002 — Timestamp SKU fallback
- Allocate Firestore doc id first → `generateSkuFromDocId(id)` → `queueDocSet`.

## Issues

### MED-001 — `agent-device fill` / `type` hang on text fields
- **Severity:** Medium (tooling / QA friction)
- **Category:** diagnostics
- **Notes:** Press/longpress/snapshot worked. Photo picker: use `adb shell input tap` + Done ref. Avoid `wait stable` on system picker.

## Verified (pass)

1. Gem card long-press → Edit / Delete
2. Edit formSheet hydrate + Save (no field change)
3. Add gem without photos (online) + Firestore proof
4. Market tab listings/filters (FlashList; no ProductGrid crash)
5. Home / Workspace signed-in trader
6. **Edit gem → upload photos (online)** — Firestore `photoUrls` non-empty

## Coverage

- [x] Open app / home baseline
- [x] Market tab
- [x] Add gem without photos (online)
- [x] Gem card long-press → Edit
- [x] Edit gem Save (no field change)
- [x] Edit gem → upload photos when online
- [ ] Offline add gem without photos
- [ ] Offline edit (fields only)

## Residual risk

- Offline QA not run: enabling airplane mode dropped wireless ADB (`adb devices` empty). Need USB ADB or re-pair wireless debugging after Wi‑Fi returns, then use wifi-off (not airplane) or keep a second transport.
- Device ~18% battery / Battery Saver made automation flaky.
