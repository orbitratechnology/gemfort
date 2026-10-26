# 005 — Color picker: single sheet with horizontal push

- **Status**: DONE
- **Commit**: dd68f33
- **Severity**: MEDIUM
- **Category**: Missed opportunity (Spatial consistency); Preventing a jarring change
- **Estimated scope**: 1 file (`src/components/workspace/gem-attribute-pickers.tsx` — `ColorPickerSheet` only), medium

## Problem

Choosing a gem color family unmounts one `BottomSheet` and mounts a second for shades. The sheet chrome teleports (close/reopen), breaking spatial continuity.

```tsx
/* src/components/workspace/gem-attribute-pickers.tsx:436-507 — current */
return (
  <>
    <BottomSheet
      visible={visible && !family}
      onClose={onClose}
      title="Color"
      scrollable={false}
    >
      {/* family list */}
    </BottomSheet>

    <BottomSheet
      visible={visible && !!family}
      onClose={() => setFamily(null)}
      title={family ? `${family.label} shades` : "Shade"}
      scrollable={false}
    >
      {/* shade list */}
    </BottomSheet>
  </>
);
```

Session reset logic above (lines 408–413) that clears `family` / `query` when `openSession` changes must remain.

## Target

1. One `BottomSheet` with `visible={visible}`, `onClose` that clears family then closes (if family set, first back to families; second call or explicit close dismisses — pick one coherent UX):
   - **Required UX**: While on shade step, sheet close / Android back / header close returns to family list (`setFamily(null)`), does **not** dismiss the sheet. A second close (or a dedicated back affordance) from family list calls `onClose()`. Backdrop tap on shade step also returns to family list.
2. Inside the sheet body: a horizontal row of two panels (families | shades), width = sheet content width.
   - `translateX`: `0` when no family; `-width` when family selected.
   - Animate with spring `Motion.spring` (`damping: 18`, `stiffness: 180`) or timing `Motion.normal` (220ms) + `easeOut`. Prefer spring for the push.
3. Title updates with step: `"Color"` vs `` `${family.label} shades` `` (can swap text without a second Modal).
4. Reduce motion: snap `translateX` (or opacity crossfade only at `Motion.fast`) — no long slide.

```tsx
/* target — single sheet shell */
<BottomSheet
  visible={visible}
  onClose={() => {
    if (family) setFamily(null);
    else onClose();
  }}
  title={family ? `${family.label} shades` : 'Color'}
  scrollable={false}
>
  <Animated.View
    style={{
      flexDirection: 'row',
      width: panelWidth * 2,
      transform: [{ translateX }],
    }}
  >
    <View style={{ width: panelWidth }}>{/* family search + FlatList */}</View>
    <View style={{ width: panelWidth }}>{/* shade search + FlatList */}</View>
  </Animated.View>
</Animated.View>
```

```tsx
/* target — push values */
// family selected:
Animated.spring(translateX, {
  toValue: -panelWidth,
  useNativeDriver: true,
  damping: Motion.spring.damping,     // 18
  stiffness: Motion.spring.stiffness, // 180
});
// back to families:
Animated.spring(translateX, {
  toValue: 0,
  useNativeDriver: true,
  damping: Motion.spring.damping,
  stiffness: Motion.spring.stiffness,
});
```

Measure `panelWidth` from the sheet body `onLayout` (content width), not a hardcoded phone width.

Selecting a shade still calls `onSelect(item.value)`, `setFamily(null)`, `onClose()` as today.

## Repo conventions to follow

- Prefer executing **001** first so enter/exit of the single sheet is correct.
- Depends on **003** for `Motion`, `easeOut`, `useReduceMotion`.
- Keep using shared `BottomSheet` — do not invent a second modal primitive.
- Match existing styles in the same file (`styles.colorRow`, `styles.searchBox`, etc.).
- `useOpenSession` / query debounce behavior must keep working.

## Steps

1. Confirm plans 003 and preferably 001 are done.
2. In `ColorPickerSheet` only inside `src/components/workspace/gem-attribute-pickers.tsx`:
   - Collapse to one `BottomSheet`.
   - Implement two-panel row + `translateX` shared value / RN `Animated.Value`.
   - Drive `translateX` when `family` changes; reset to `0` when session resets or sheet closes.
   - Update `onClose` behavior per Target (back vs dismiss).
3. Leave `OriginPickerSheet` and other pickers in this file untouched.
4. Wire reduce-motion: instantaneous `setValue` to target X, or opacity crossfade at `Motion.fast`.

## Boundaries

- Do NOT refactor unrelated pickers in the same file.
- Do NOT change gem color data (`GEM_COLOR_FAMILIES`) or selection value format.
- Do NOT add `@gorhom/bottom-sheet` or new dependencies.
- Do NOT use `Motion.slow`.
- Do NOT animate width/height of the sheet for the push — only `translateX` (and opacity if reduce-motion crossfade).
- If `ColorPickerSheet` structure drifted from `dd68f33`, STOP and report.

## Verification

- **Mechanical**: `bun run typecheck`; `bun run lint`.
- **Feel check**:
  - Open color picker on add-gem flow: one sheet opens.
  - Tap a family: content pushes left to shades; grabber/sheet shell stays put (no Modal remount blink).
  - Close / back from shades: returns to family list with push-back; sheet stays open.
  - Close from family list: sheet dismisses via BottomSheet exit.
  - Select a shade: sheet closes and value applies.
  - Reduce Motion: no long horizontal slide (snap or short fade).
- **Done when**: only one `BottomSheet` instance in `ColorPickerSheet`; family→shade is a horizontal push using `Motion.spring` or `Motion.normal` + `easeOut`.
