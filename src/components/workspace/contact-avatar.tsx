import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { Typography } from '@/constants/design-tokens';

type ContactAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ContactAvatar({ name, photoUrl, size = 48 }: ContactAvatarProps) {
  const { colors } = useAppTheme();
  const radius = size / 2;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        accessibilityLabel={`${name} photo`}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.primaryMuted,
        },
      ]}>
      <Text style={[styles.text, { color: colors.primary, fontSize: size * 0.32 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { ...Typography.bodyLg, fontWeight: '700' },
});
