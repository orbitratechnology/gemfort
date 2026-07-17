# Animation plans (Gemfort)

Self-contained executor plans from the whole-app motion audit. **Do not invent values** — each plan spells out durations, springs, and curves. Stamp: `dd68f33`.

## Status

| # | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 003 | Wire Motion tokens + reduce-motion helper | MEDIUM | TODO | — |
| 001 | Bottom sheet exit and height offset | MEDIUM | TODO | 003 |
| 002 | Toast interruptible retarget | MEDIUM | TODO | 003 |
| 004 | EmptyState entrance | LOW | TODO | 003 |
| 005 | Color picker single-sheet push | MEDIUM | TODO | 001 (recommended) |

## Recommended execution order

1. **003** — foundation (`Motion` consumption + `useReduceMotion`)
2. **001** — bottom sheet (every filter/picker inherits this)
3. **002** — toast retarget
4. **004** — EmptyState entrance
5. **005** — color family → shade push (benefits from fixed sheet in 001)

## Deferred (no plan file yet)

- Cheque bounce form ↔ status grid crossfade
- Business profile WhatsApp/Call press scale
- Home banner `FadeIn` trim
- Bottom sheet drag-to-dismiss

## How to execute

Hand a single plan file to an agent (or run `improve-animations execute <plan>`). One plan per run. Feel-check on a real device after each.
