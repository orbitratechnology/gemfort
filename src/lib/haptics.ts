import * as Haptics from 'expo-haptics';

/**
 * Semantic haptic feedback for GemFort.
 *
 * Prefer these helpers over calling `expo-haptics` directly so feedback stays
 * consistent (Apple-style: meaningful moments only — tap, select, commit,
 * success/error) and Android uses the recommended platform engine.
 *
 * Usage:
 *   import { haptics } from '@/lib/haptics';
 *   haptics.selection();
 *   haptics.success();
 *   onPress={haptics.wrap('light', handleSave)}
 */

type NativeOs = 'ios' | 'android';

function nativeOs(): NativeOs | null {
  if (process.env.EXPO_OS === 'ios') return 'ios';
  if (process.env.EXPO_OS === 'android') return 'android';
  return null;
}

function fire(run: () => Promise<void>) {
  if (!nativeOs()) return;
  void run().catch(() => {
    // Devices without a Taptic Engine / vibrator — ignore.
  });
}

async function impact(style: Haptics.ImpactFeedbackStyle) {
  const os = nativeOs();
  if (os === 'android') {
    const androidMap: Record<Haptics.ImpactFeedbackStyle, Haptics.AndroidHaptics> = {
      [Haptics.ImpactFeedbackStyle.Light]: Haptics.AndroidHaptics.Virtual_Key,
      [Haptics.ImpactFeedbackStyle.Soft]: Haptics.AndroidHaptics.Virtual_Key,
      [Haptics.ImpactFeedbackStyle.Medium]: Haptics.AndroidHaptics.Keyboard_Tap,
      [Haptics.ImpactFeedbackStyle.Rigid]: Haptics.AndroidHaptics.Context_Click,
      [Haptics.ImpactFeedbackStyle.Heavy]: Haptics.AndroidHaptics.Long_Press,
    };
    await Haptics.performAndroidHapticsAsync(androidMap[style]);
    return;
  }
  await Haptics.impactAsync(style);
}

async function notify(type: Haptics.NotificationFeedbackType) {
  const os = nativeOs();
  if (os === 'android') {
    const androidMap: Record<Haptics.NotificationFeedbackType, Haptics.AndroidHaptics> = {
      [Haptics.NotificationFeedbackType.Success]: Haptics.AndroidHaptics.Confirm,
      [Haptics.NotificationFeedbackType.Warning]: Haptics.AndroidHaptics.Long_Press,
      [Haptics.NotificationFeedbackType.Error]: Haptics.AndroidHaptics.Reject,
    };
    await Haptics.performAndroidHapticsAsync(androidMap[type]);
    return;
  }
  await Haptics.notificationAsync(type);
}

export type HapticKind =
  | 'selection'
  | 'light'
  | 'soft'
  | 'medium'
  | 'rigid'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'tap'
  | 'commit'
  | 'sheetOpen'
  | 'sheetClose'
  | 'longPress'
  | 'confirm';

const triggers: Record<HapticKind, () => void> = {
  /** Discrete choice changed — chips, segmented controls, pickers. */
  selection: () =>
    fire(async () => {
      if (nativeOs() === 'android') {
        await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
        return;
      }
      await Haptics.selectionAsync();
    }),

  /** Press-down on buttons / tappable rows (Apple: feedback on touch-down). */
  light: () => fire(() => impact(Haptics.ImpactFeedbackStyle.Light)),
  soft: () => fire(() => impact(Haptics.ImpactFeedbackStyle.Soft)),
  medium: () => fire(() => impact(Haptics.ImpactFeedbackStyle.Medium)),
  rigid: () => fire(() => impact(Haptics.ImpactFeedbackStyle.Rigid)),
  heavy: () => fire(() => impact(Haptics.ImpactFeedbackStyle.Heavy)),

  /** Outcome of a task — pair with toasts / submission results. */
  success: () => fire(() => notify(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => notify(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => notify(Haptics.NotificationFeedbackType.Error)),

  /** Semantic aliases — prefer these at call sites. */
  tap: () => triggers.light(),
  commit: () => triggers.medium(),
  sheetOpen: () => triggers.soft(),
  sheetClose: () => triggers.light(),
  longPress: () =>
    fire(async () => {
      if (nativeOs() === 'android') {
        await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
        return;
      }
      await impact(Haptics.ImpactFeedbackStyle.Rigid);
    }),
  /** Confirmation / destructive alert presented. */
  confirm: () => triggers.warning(),
};

export const haptics = {
  ...triggers,

  /**
   * Fire a haptic then run the handler — drop-in for `onPress`:
   * `onPress={haptics.wrap('selection', () => setFilter(id))}`
   */
  wrap<Args extends unknown[]>(
    kind: HapticKind,
    handler?: (...args: Args) => void,
  ): (...args: Args) => void {
    return (...args: Args) => {
      triggers[kind]();
      handler?.(...args);
    };
  },

  /** Fire a named haptic. Useful when the kind is dynamic. */
  play(kind: HapticKind) {
    triggers[kind]();
  },
};
