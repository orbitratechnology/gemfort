import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { TouchTarget } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

/** Trailing eye control for password fields (≥44pt hit target). */
export function PasswordVisibilityToggle({ visible, onToggle }: PasswordVisibilityToggleProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={4}
      onPress={onToggle}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.7 }]}>
      <Icon
        name={visible ? 'visibility' : 'visibility-off'}
        size={22}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
});
