import { Alert, type AlertButton, type AlertOptions } from 'react-native';

import { haptics, type HapticKind } from '@/lib/haptics';

type AlertHaptic = Extract<HapticKind, 'confirm' | 'warning' | 'error' | 'success'> | 'none';

type AppAlertOptions = AlertOptions & {
  /** Haptic when the alert is presented. Defaults to `confirm` (warning). */
  haptic?: AlertHaptic;
};

/**
 * Drop-in for `Alert.alert` with a confirmation haptic on present.
 * Destructive flows keep feeling intentional without editing every button handler.
 */
export function alert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AppAlertOptions,
) {
  const kind = options?.haptic ?? 'confirm';
  if (kind !== 'none') haptics.play(kind);

  const { haptic: _haptic, ...rest } = options ?? {};
  Alert.alert(title, message, buttons, rest);
}
