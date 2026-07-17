# 004 — EmptyState entrance (scale + opacity)

- **Status**: TODO
- **Commit**: dd68f33
- **Severity**: LOW
- **Category**: Missed opportunity (Delight)
- **Estimated scope**: 1 file (`src/components/ui/empty-state.tsx`), small

## Problem

Occasional empty lists (home, cheques, jobs, pickers, etc.) render a flat icon + copy with no entrance. This is a rare/first-visit surface where a short, restrained entrance is allowed.

```tsx
/* src/components/ui/empty-state.tsx:20-30 — current */
return (
  <View style={styles.container}>
    <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
      <Icon name={icon} size={28} color={colors.primary} />
    </View>
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {subtitle ? (
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    ) : null}
    {action}
  </View>
);
```

No animation imports; no reduce-motion handling.

## Target

On mount only (once per mount):

1. Icon wrap: `opacity` 0 → 1 and `scale` 0.96 → 1.
   - Prefer spring for scale: `Motion.spring` (`damping: 18`, `stiffness: 180`) with `useNativeDriver: true`.
   - Opacity timing: `Motion.normal` (220ms), `easing: easeOut`.
2. Title + subtitle + action: opacity 0 → 1 starting ~80ms after icon (stagger decorative, must not block taps). Duration `Motion.normal` (220ms), `easeOut`. Cap total feel under ~300ms of meaningful motion.
3. Never use `scale(0)` — floor is `0.96`.
4. Reduce motion: opacity-only on icon and copy over `Motion.fast` (120ms); scale stays `1`.

```tsx
/* target — mount animation values */
// icon
opacityIcon: 0 → 1, duration Motion.normal (220), easeOut
scaleIcon: 0.96 → 1, spring Motion.spring { damping: 18, stiffness: 180 }
// copy block (delay 80ms)
opacityCopy: 0 → 1, duration Motion.normal (220), easeOut
// reduceMotion
opacity only, duration Motion.fast (120), scale fixed at 1, no delay required
```

Use RN `Animated` (matches toast/sheet) or Reanimated `FadeIn` + scale — **prefer RN `Animated`** for cohesion with 001/002 and to avoid mixing enter APIs. Keep `useNativeDriver: true`.

## Repo conventions to follow

- Depends on **003** for `Motion`, `easeOut`, `useReduceMotion`.
- Component stays presentational; props API unchanged (`title`, `subtitle`, `action`, `icon`).
- Styles in `StyleSheet.create` at bottom of the same file — do not invent a new design system.
- Exemplar press scale elsewhere uses ~0.96–0.98; entrance starts at `0.96` to match that physicality band.

## Steps

1. Confirm plan 003 landed.
2. In `src/components/ui/empty-state.tsx`:
   - Import `Animated`, `useEffect`, `useRef`/`useState` as needed.
   - Import `Motion`, `easeOut`, `useReduceMotion`.
   - Wrap icon container in `Animated.View` with `opacity` + `transform: [{ scale }]`.
   - Wrap title/subtitle/action in an `Animated.View` with `opacity`.
   - `useEffect` on mount runs the parallel/staggered animations once; cleanup stop animations on unmount.
3. Ensure `action` remains pressable immediately (animations must not use `pointerEvents="none"` for longer than the entrance, preferably never).

## Boundaries

- Do NOT add stagger across every EmptyState child individually beyond icon vs copy group.
- Do NOT use `Motion.slow` or bounce > what `Motion.spring` already implies.
- Do NOT animate layout properties (height/width/margin).
- Do NOT change EmptyState call sites.
- Do NOT add dependencies.
- If file drifted from `dd68f33`, STOP and report.

## Verification

- **Mechanical**: `bun run typecheck`; `bun run lint`.
- **Feel check**:
  - Open a screen with an empty list (e.g. empty cheques or jobs): icon gently scales from 0.96 and fades; copy follows ~80ms later; total feels quick, not theatrical.
  - Navigate away and back: entrance plays again on remount (acceptable).
  - Reduce Motion: short opacity fade only; no scale.
  - Tap CTA in `action` during/after entrance: still works.
- **Done when**: entrance uses scale ≥0.96 + opacity; timings match `Motion`; reduce-motion path exists.
