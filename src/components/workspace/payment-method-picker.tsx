import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import type { PaymentMethodOption } from "@/constants/payment-methods";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

type PaymentMethodPickerProps<T extends string> = {
  label: string;
  options: PaymentMethodOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
};

export function PaymentMethodPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "Choose a payment method",
  error,
}: PaymentMethodPickerProps<T>) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint="Opens payment methods"
        accessibilityState={{ selected: selected !== null }}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.error : colors.outlineVariant,
            opacity: pressed ? 0.86 : 1,
          },
        ]}>
        <MethodMark option={selected} selected={false} />
        <View style={styles.triggerText}>
          <Text
            style={[styles.methodLabel, { color: colors.onSurface }]}
            numberOfLines={1}>
            {selected?.label ?? placeholder}
          </Text>
          <Text
            style={[styles.methodSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}>
            {selected?.subtitle ?? "Tap to see available options"}
          </Text>
        </View>
        <Icon
          name="expand-more"
          size={22}
          color={colors.onSurfaceVariant}
        />
      </Pressable>
      {error ? (
        <Text
          selectable
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.error }]}>
          {error}
        </Text>
      ) : null}

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="Choose a payment method"
        fitToContents>
        <View
          style={styles.options}
          accessibilityRole="radiogroup"
          accessibilityLabel="Payment methods">
          <Text style={[styles.description, { color: colors.textMuted }]}>
            Select how this transaction was paid.
          </Text>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={
                  option.subtitle
                    ? `${option.label}, ${option.subtitle}`
                    : option.label
                }
                accessibilityState={{ selected: active }}
                onPress={haptics.wrap("selection", () => {
                  onChange(option.value);
                  setVisible(false);
                })}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active
                      ? colors.primaryContainer
                      : colors.surfaceContainerLow,
                    borderColor: active ? colors.primary : colors.outlineVariant,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}>
                <MethodMark option={option} selected={active} />
                <View style={styles.optionText}>
                  <Text style={[styles.methodLabel, { color: colors.onSurface }]}>
                    {option.label}
                  </Text>
                  {option.subtitle ? (
                    <Text
                      style={[styles.methodSubtitle, { color: colors.textMuted }]}>
                      {option.subtitle}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.outline,
                    },
                  ]}>
                  {active ? (
                    <Icon name="check" size={15} color={colors.onPrimary} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

function MethodMark({
  option,
  selected,
}: {
  option: PaymentMethodOption | null;
  selected: boolean;
}) {
  const { colors } = useAppTheme();
  const toneColor =
    option?.tone === "success"
      ? colors.successEmerald
      : option?.tone === "warning"
        ? colors.warningAmber
        : colors.primary;

  return (
    <View
      style={[
        styles.mark,
      ]}>
      {option?.image ? (
        <Image
          source={option.image}
          style={styles.image}
          contentFit="contain"
          accessible={false}
        />
      ) : (
        <Icon
          name={option?.icon ?? "payments"}
          size={22}
          color={toneColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.stackSm },
  label: { ...Typography.labelMd },
  trigger: {
    minHeight: 68,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.stackSm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  triggerText: { flex: 1, minWidth: 0, gap: 2 },
  methodLabel: { ...Typography.bodyMd, fontWeight: "600" },
  methodSubtitle: { ...Typography.bodySmall },
  options: { gap: Spacing.stackSm, paddingBottom: Spacing.sm },
  description: { ...Typography.bodySmall, paddingBottom: Spacing.xs },
  option: {
    minHeight: 72,
    padding: Spacing.stackMd,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  optionText: { flex: 1, minWidth: 0, gap: 3 },
  mark: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 42, height: 42 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { ...Typography.bodySmall },
});
