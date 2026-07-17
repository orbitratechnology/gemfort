# 001 — Fix bottom sheet exit and height offset

- **Status**: TODO
- **Commit**: dd68f33
- **Severity**: MEDIUM
- **Category**: Interruptibility / physicality; Easing & duration
- **Estimated scope**: 1 file (`src/components/ui/bottom-sheet.tsx`), medium

## Problem

The shared bottom sheet hardcodes a `600` px off-screen offset, enters with one spring, exits with fixed-duration timing (no easing), and when `visible` becomes `false` it snaps via `setValue` instead of always exiting through the animated close path. That makes dismiss feel inconsistent and can clip tall sheets.

```tsx
/* src/components/ui/bottom-sheet.tsx:45-64 — current */
const [translateY] = useState(() => new Animated.Value(600));
const [backdrop] = useState(() => new Animated.Value(0));

useEffect(() => {
  if (visible) {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  } else {
    translateY.setValue(600);
    backdrop.setValue(0);
  }
}, [visible, translateY, backdrop]);

function handleClose() {
  Animated.parallel([
    Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }),
    Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
  ]).start(onClose);
}
```

```tsx
/* src/components/ui/bottom-sheet.tsx:68 — current */
<Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
```

When parent sets `visible={false}` without going through `handleClose`, the Modal unmounts instantly and the `else` branch snaps values — no exit animation.

## Target

1. Track sheet height via `onLayout` on the sheet view; use that height (fallback `Dimensions.get('window').height` until measured) as the off-screen `translateY` offset — never the magic number `600`.
2. Keep Modal presented until the exit animation finishes (`presented` local state): open when `visible` becomes true; on close request animate out then set `presented` false and call `onClose`.
3. Enter: spring using `Motion.spring` (`damping: 18`, `stiffness: 180`); backdrop fade `Motion.normal` (220ms) with `easeOut`.
4. Exit: translateY → measured height over `Motion.normal` (220ms) with `easeOut`; backdrop → 0 over `Motion.normal` (220ms) with `easeOut`. Symmetric path (same edge).
5. Reduce motion: skip translate; fade backdrop/opacity only over `Motion.fast` (120ms) with `easeOut`.

```tsx
/* target values */
import { Motion } from '@/constants/design-tokens';
import { easeOut, useReduceMotion } from '@/hooks/use-reduce-motion';

// enter sheet
Animated.spring(translateY, {
  toValue: 0,
  useNativeDriver: true,
  damping: Motion.spring.damping,   // 18
  stiffness: Motion.spring.stiffness, // 180
});
// enter backdrop
Animated.timing(backdrop, {
  toValue: 1,
  duration: Motion.normal, // 220
  easing: easeOut,         // Easing.bezier(0.23, 1, 0.32, 1)
  useNativeDriver: true,
});
// exit sheet + backdrop
Animated.timing(translateY, {
  toValue: sheetHeight,    // from onLayout, not 600
  duration: Motion.normal, // 220
  easing: easeOut,
  useNativeDriver: true,
});
Animated.timing(backdrop, {
  toValue: 0,
  duration: Motion.normal, // 220
  easing: easeOut,
  useNativeDriver: true,
});
```

`Modal` must use `visible={presented}` where `presented` stays true until exit animation callback fires.

## Repo conventions to follow

- Depends on **003** (`Motion`, `useReduceMotion`, `easeOut`). Execute 003 first.
- Keep RN `Animated` + `useNativeDriver: true` (transform + opacity only) — do not migrate this file to Reanimated in this plan.
- Exemplar consumer pattern for tokens: import from `@/constants/design-tokens` like other UI components already do for `Radius` / `Spacing`.
- Preserve public props: `visible`, `onClose`, `title`, `children`, `footer`, `scrollable`.

## Steps

1. Ensure plan 003 is done (`@/hooks/use-reduce-motion` exports `useReduceMotion` and `easeOut`; `Motion` importable).
2. In `src/components/ui/bottom-sheet.tsx`:
   - Import `Dimensions`, `Easing` only if needed; prefer `easeOut` from the hook file.
   - Import `Motion` from `@/constants/design-tokens`.
   - Import `useReduceMotion`, `easeOut` from `@/hooks/use-reduce-motion`.
   - Add `const reduceMotion = useReduceMotion()`.
   - Replace hardcoded `600` with a ref/state `sheetOffset` updated in `onLayout` of the sheet `Animated.View` (`e.nativeEvent.layout.height`), initialised to `Dimensions.get('window').height`.
   - Add `presented` state: when `visible` goes true, set `presented` true and run enter animation; when `visible` goes false while `presented`, run exit animation then set `presented` false (do not hard `setValue` in the false branch without animating).
   - Wire `handleClose` to animate exit then call `onClose()` (parent sets `visible` false). If parent flips `visible` false directly, still animate exit via the effect watching `visible`.
   - Guard against double-close (ignore close while already exiting).
3. Apply reduce-motion branch: enter/exit with opacity/backdrop only at `Motion.fast` (120ms), `translateY` stays at `0` when reduced (or set immediately without spring).
4. Keep `FilterChipGroup` and styles unchanged aside from layout handler on the sheet container.

## Boundaries

- Do NOT add `@gorhom/bottom-sheet` or drag-to-dismiss (deferred).
- Do NOT change FilterChipGroup behavior or chip styles.
- Do NOT change call sites of `BottomSheet`.
- Do NOT use `Motion.slow` (360).
- Do NOT animate width/height/layout properties — only `transform` and `opacity`.
- Do NOT add new dependencies.
- If code has drifted from commit `dd68f33`, STOP and report.

## Verification

- **Mechanical**: `bun run typecheck`; `bun run lint`.
- **Feel check** (device):
  - Open Directory filters or any gem attribute picker: sheet springs up from bottom within ~220–400ms; no jump from a wrong offset on tall content.
  - Tap backdrop / close: sheet slides down the same edge; Modal stays until motion ends (no flash-cut).
  - Spam open/close: animations retarget or ignore mid-exit cleanly — no stuck backdrop.
  - Enable Reduce Motion in OS accessibility settings: sheet appears/disappears with a short fade only; no long slide.
- **Done when**: no literal `600` offset remains for sheet travel; enter uses `Motion.spring`; exit uses `Motion.normal` + `easeOut`; `presented` bridges Modal visibility through exit.
