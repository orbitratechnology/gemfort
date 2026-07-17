# 002 — Make toast show interruptible (no hard reset)

- **Status**: TODO
- **Commit**: dd68f33
- **Severity**: MEDIUM
- **Category**: Interruptibility; Easing & duration
- **Estimated scope**: 1 file (`src/providers/toast-provider.tsx`), small

## Problem

When a new toast fires while one is visible (or mid-animation), `show` hard-resets animated values to the hidden state, then restarts enter from zero. Rapid success/error sequences feel like a blink instead of a smooth retarget. Timing also omits explicit ease-out and ignores shared `Motion` tokens.

```tsx
/* src/providers/toast-provider.tsx:43-60 — current */
const hide = useCallback(() => {
  Animated.parallel([
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    Animated.timing(translateY, { toValue: -20, duration: 180, useNativeDriver: true }),
  ]).start(() => setToast(null));
}, [opacity, translateY]);

const show = useCallback(
  (message: string, options?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, variant: options?.variant ?? 'info' });
    opacity.setValue(0);
    translateY.setValue(-20);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }),
    ]).start();
    timer.current = setTimeout(hide, options?.duration ?? 3000);
  },
  [hide, opacity, translateY],
);
```

## Target

1. On replacement while a toast is already shown: update `message` / `variant` in place; **do not** call `opacity.setValue(0)` or `translateY.setValue(-20)`. Animate toward settled state from current values (`toValue: 1` / `0`) so mid-flight motion retargets.
2. Only hard-set hidden values when there is no toast mounted (first show after null).
3. Use `Motion` + `easeOut`:
   - Enter opacity: `Motion.normal` (220ms), `easing: easeOut`
   - Enter translateY: spring `Motion.spring` (`damping: 18`, `stiffness: 180`)
   - Exit opacity + translateY: `Motion.normal` (220ms), `easing: easeOut`, to `0` and `-20`
4. Reduce motion: opacity-only enter/exit at `Motion.fast` (120ms); keep `translateY` at `0`.

```tsx
/* target — show (pseudocode) */
const show = (message, options) => {
  if (timer.current) clearTimeout(timer.current);
  idRef.current += 1;
  const next = { id: idRef.current, message, variant: options?.variant ?? 'info' };
  const isReplacement = toast != null; // use ref for toast presence to avoid stale closure

  setToast(next);

  if (!isReplacement) {
    if (!reduceMotion) {
      opacity.setValue(0);
      translateY.setValue(-20);
    } else {
      opacity.setValue(0);
      translateY.setValue(0);
    }
  }

  if (reduceMotion) {
    Animated.timing(opacity, {
      toValue: 1,
      duration: Motion.fast, // 120
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  } else {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.normal, // 220
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: Motion.spring.damping,     // 18
        stiffness: Motion.spring.stiffness, // 180
      }),
    ]).start();
  }
  timer.current = setTimeout(hide, options?.duration ?? 3000);
};
```

```tsx
/* target — hide */
Animated.parallel([
  Animated.timing(opacity, {
    toValue: 0,
    duration: reduceMotion ? Motion.fast : Motion.normal,
    easing: easeOut,
    useNativeDriver: true,
  }),
  Animated.timing(translateY, {
    toValue: reduceMotion ? 0 : -20,
    duration: reduceMotion ? Motion.fast : Motion.normal,
    easing: easeOut,
    useNativeDriver: true,
  }),
]).start(() => setToast(null));
```

Enter and exit must use the **same edge** (top: `translateY` from `-20` → `0` → `-20`).

## Repo conventions to follow

- Depends on **003**.
- Keep RN `Animated` + `useNativeDriver: true`.
- Provider pattern stays in `src/providers/toast-provider.tsx`; public API (`show` / `success` / `error` / `info`) unchanged.
- Use a ref for “toast currently visible” if needed so `show` does not depend on stale `toast` state (match existing `timer` / `idRef` style in the same file).

## Steps

1. Confirm plan 003 landed.
2. Import `Motion` from `@/constants/design-tokens` and `easeOut`, `useReduceMotion` from `@/hooks/use-reduce-motion`.
3. Add `toastVisibleRef` (or equivalent) updated whenever toast mounts/unmounts.
4. Rewrite `show` / `hide` per Target; remove hard reset on replacement.
5. Call `reduceMotion` from the hook inside the provider.

## Boundaries

- Do NOT change toast visual styles (shadow, colors, layout) except animated props.
- Do NOT stack multiple toast views — single toast in place is correct.
- Do NOT use `Motion.slow`.
- Do NOT migrate to Reanimated in this plan.
- Do NOT add dependencies.
- If file drifted from `dd68f33`, STOP and report.

## Verification

- **Mechanical**: `bun run typecheck`; `bun run lint`.
- **Feel check**:
  - Trigger `toast.success` then immediately `toast.error`: message/variant updates without a full blink to invisible; motion continues from current opacity/Y.
  - Single toast: enters from top (~220ms), auto-hides via same edge.
  - Tap toast to dismiss: exits top edge cleanly.
  - Reduce Motion on: opacity fade only (~120ms), no vertical travel.
- **Done when**: no `setValue(0)` / `setValue(-20)` on the replacement path; durations/springs match `Motion`; ease-out on all timings.
