import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type ContactAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

function initials(name: string) {
  return (
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function ContactAvatar({ name, photoUrl, size = 48 }: ContactAvatarProps) {
  const { colors } = useAppTheme();
  const radius = size / 2;
  // Track which URL failed so a new photoUrl retries without an effect reset.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!photoUrl && failedUrl !== photoUrl;

  if (showImage) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        accessibilityLabel={`${name} photo`}
        onError={() => setFailedUrl(photoUrl)}
      />
    );
  }

  return (
    <View
      style={StyleSheet.flatten([
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.primaryMuted,
        },
      ])}
    >
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
