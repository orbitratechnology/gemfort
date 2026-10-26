# 003 — Wire Motion tokens and reduce-motion helper

- **Status**: DONE
- **Commit**: dd68f33
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens; Accessibility
- **Estimated scope**: 2 files (1 new hook, 1 token comment); small. Sheet/toast consumption happens in 001/002.

## Problem

Shared motion tokens exist but nothing imports them. Three different springs and ad-hoc durations live in toast/sheet instead. There is also zero reduce-motion handling anywhere under `src/`.

```ts
/* src/constants/design-tokens.ts:370-375 — current */
export const Motion = {
  fast: 120,
  normal: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180 },
} as const;
```

Grep confirms `Motion` is only referenced in that file. Grep for `reduceMotion` / `isReduceMotionEnabled` / `AccessibilityInfo` under `src/` returns zero hits.

`Motion.slow: 360` exceeds the UI duration budget (≤300ms). It must not be used for functional UI chrome.

## Target

1. Keep `Motion` values as-is, but document that `slow` is reserved for rare/marketing moments only (not sheets, toasts, presses).
2. Add `src/hooks/use-reduce-motion.ts` that returns a boolean from `AccessibilityInfo`, subscribed to changes.
3. Do **not** rewrite sheet/toast in this plan — 001 and 002 will import `Motion` and `useReduceMotion`. This plan only creates the foundation other plans depend on.

```ts
/* target — useReduceMotion */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
```

```ts
/* target — design-tokens comment above Motion */
/** Durations in ms. `slow` is marketing/rare only — do not use for sheets, toasts, or presses (UI budget ≤300ms). */
export const Motion = {
  fast: 120,
  normal: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180 },
} as const;
```

RN ease-out curve to use in later plans (document here for cohesion; do not add a CSS file):

```ts
import { Easing } from 'react-native';
// AUDIT --ease-out: cubic-bezier(0.23, 1, 0.32, 1)
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
```

Optionally export `easeOut` from the same new file or from `design-tokens.ts` as `MotionEasing.easeOut`. Prefer colocating with the hook file as:

```ts
/* src/hooks/use-reduce-motion.ts — also export */
import { Easing } from 'react-native';
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
```

## Repo conventions to follow

- Hooks live in `src/hooks/` as kebab-case files; named exports matching filename (see `src/hooks/use-app-theme.ts`).
- Design tokens live in `src/constants/design-tokens.ts`; import as `@/constants/design-tokens`.
- Do not add Moti/Lottie/new animation libraries.
- Keep path aliases (`@/`).

## Steps

1. Add a one-line JSDoc above `Motion` in `src/constants/design-tokens.ts` stating `slow` is marketing/rare only and UI chrome must use `fast` / `normal` / `spring`.
2. Create `src/hooks/use-reduce-motion.ts` with `useReduceMotion` and `easeOut` exactly as in Target.
3. Smoke-import check: no other files need changing in this plan. Confirm `bun run typecheck` still passes.

## Boundaries

- Do NOT modify `bottom-sheet.tsx`, `toast-provider.tsx`, `empty-state.tsx`, or `gem-attribute-pickers.tsx` in this plan.
- Do NOT change `Motion.fast` / `Motion.normal` / `Motion.spring` numeric values.
- Do NOT delete `Motion.slow`.
- Do NOT add new dependencies.
- If `AccessibilityInfo.addEventListener` API differs from the snippet on this RN version, use the project’s RN 0.86 docs pattern and keep the same boolean return shape — do not invent a different hook API.

## Verification

- **Mechanical**: `bun run typecheck` exits 0; `bun run lint` exits 0 (or only pre-existing warnings).
- **Feel check**: N/A for this plan alone (no UI change). Confirm the hook file exists and exports are importable from `@/hooks/use-reduce-motion`.
- **Done when**: `useReduceMotion` and `easeOut` exist; `Motion` has the JSDoc; no app behavior changed yet.
