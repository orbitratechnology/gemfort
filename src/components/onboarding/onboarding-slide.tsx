import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHero } from '@/components/onboarding/onboarding-hero';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { OnboardingChapter } from '@/constants/brand-story';
import { Motion, Spacing, Typography } from '@/constants/design-tokens';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const WHITE = '#FFFFFF';
const WHITE_MUTED = 'rgba(255,255,255,0.72)';
const WHITE_SOFT = 'rgba(255,255,255,0.55)';
const INK = '#171717';

type OnboardingSlideProps = {
  chapter: OnboardingChapter;
  index: number;
  total: number;
  width: number;
  height: number;
  isActive: boolean;
  onContinue: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onBrowseGuest: () => void;
  onSkip: () => void;
};

export function OnboardingSlide({
  chapter,
  index,
  total,
  width,
  height,
  isActive,
  onContinue,
  onCreateAccount,
  onSignIn,
  onBrowseGuest,
  onSkip,
}: OnboardingSlideProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const enterDown = reduceMotion
    ? undefined
    : FadeInDown.duration(Motion.normal).delay(60);

  return (
    <View style={{ width, height, backgroundColor: '#000000' }}>
      <OnboardingHero chapterId={chapter.id} width={width} height={height} />

      {!isFirst ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + Spacing.sm,
            right: Spacing.lg,
            zIndex: 2,
          }}>
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            style={{
              minHeight: 44,
              minWidth: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: Spacing.sm,
            }}>
            <Text style={{ ...Typography.label, color: WHITE_SOFT }}>Skip</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bottom content */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: Spacing.xxl,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.sm,
          gap: Spacing.md,
          experimental_backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 28%, #000000 55%)',
          paddingTop: Spacing.section,
        }}>
        {isActive ? (
          <Animated.View entering={enterDown} style={{ gap: Spacing.md }}>
            <Text style={{ ...Typography.caption, color: WHITE_SOFT, letterSpacing: 1.2 }}>
              {index + 1} of {total}
            </Text>
            <Text
              style={{
                ...Typography.story,
                color: WHITE,
                maxWidth: 340,
              }}>
              {chapter.title}
            </Text>
            {chapter.subtitle ? (
              <Text
                style={{
                  ...Typography.headlineSm,
                  color: WHITE,
                  maxWidth: 340,
                }}>
                {chapter.subtitle}
              </Text>
            ) : null}
            <Text
              style={{
                ...Typography.bodyLarge,
                color: WHITE_MUTED,
                maxWidth: 340,
              }}>
              {chapter.body}
            </Text>

            {chapter.roles ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: Spacing.sm,
                  marginTop: Spacing.xs,
                }}>
                {chapter.roles.map((role) => (
                  <View
                    key={role.id}
                    style={{
                      flex: 1,
                      gap: Spacing.xs,
                      paddingVertical: Spacing.sm,
                      alignItems: 'center',
                    }}
                    accessibilityRole="text"
                    accessibilityLabel={`${role.label}: ${role.subtitle}`}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Icon name={role.icon} size={20} color={WHITE} />
                    </View>
                    <Text
                      style={{
                        ...Typography.label,
                        color: WHITE,
                        textAlign: 'center',
                      }}>
                      {role.label}
                    </Text>
                    <Text
                      style={{
                        ...Typography.caption,
                        color: WHITE_SOFT,
                        textAlign: 'center',
                      }}>
                      {role.subtitle}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
              {isLast ? (
                <>
                  <Button
                    title="Create account"
                    icon="person-add"
                    iconColor={INK}
                    onPress={onCreateAccount}
                    style={{ backgroundColor: WHITE }}
                    textStyle={{ color: INK }}
                  />
                  <Pressable
                    onPress={onSignIn}
                    accessibilityRole="link"
                    accessibilityLabel="Sign in"
                    style={{
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ ...Typography.body, color: WHITE_MUTED }}>
                      Already on GemFort?{' '}
                      <Text style={{ color: WHITE, textDecorationLine: 'underline' }}>Sign in</Text>
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onBrowseGuest}
                    accessibilityRole="button"
                    accessibilityLabel="Browse as guest"
                    style={{
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ ...Typography.bodySmall, color: WHITE_SOFT }}>
                      Browse as guest
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Button
                  title={chapter.cta}
                  icon="arrow-forward"
                  iconColor={INK}
                  onPress={onContinue}
                  style={{ backgroundColor: WHITE }}
                  textStyle={{ color: INK }}
                />
              )}
            </View>
          </Animated.View>
        ) : (
          <View style={{ gap: Spacing.md, opacity: 0.35 }}>
            <Text style={{ ...Typography.caption, color: WHITE_SOFT }}>
              {index + 1} of {total}
            </Text>
            <Text style={{ ...Typography.story, color: WHITE }}>{chapter.title}</Text>
            {chapter.subtitle ? (
              <Text style={{ ...Typography.headlineSm, color: WHITE }}>{chapter.subtitle}</Text>
            ) : null}
            <Text style={{ ...Typography.bodyLarge, color: WHITE_MUTED }}>{chapter.body}</Text>
            <View style={{ height: isLast ? 160 : 56 }} />
          </View>
        )}
      </View>
    </View>
  );
}
