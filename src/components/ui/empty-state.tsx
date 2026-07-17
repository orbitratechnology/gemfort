import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Motion, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { easeOut, useReduceMotion } from '@/hooks/use-reduce-motion';

export function EmptyState({
  title,
  subtitle,
  action,
  icon = 'inbox',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [iconOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.96));
  const [copyOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      iconScale.setValue(1);
      const anim = Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: Motion.fast,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: Motion.fast,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]);
      anim.start();
      return () => anim.stop();
    }

    iconScale.setValue(0.96);
    iconOpacity.setValue(0);
    copyOpacity.setValue(0);

    const iconAnim = Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: Motion.spring.damping,
        stiffness: Motion.spring.stiffness,
      }),
    ]);
    const copyAnim = Animated.timing(copyOpacity, {
      toValue: 1,
      duration: Motion.normal,
      easing: easeOut,
      delay: 80,
      useNativeDriver: true,
    });

    iconAnim.start();
    copyAnim.start();
    return () => {
      iconAnim.stop();
      copyAnim.stop();
    };
  }, [reduceMotion, iconOpacity, iconScale, copyOpacity]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.primaryMuted,
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}>
        <Icon name={icon} size={28} color={colors.primary} />
      </Animated.View>
      <Animated.View style={{ opacity: copyOpacity, alignItems: 'center', gap: Spacing.sm }}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
        {action}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
});
