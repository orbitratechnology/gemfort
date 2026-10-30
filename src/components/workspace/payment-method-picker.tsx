import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from "@/components/ui/field-chrome";
import { Accent, IconBubble } from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
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
  const chrome = useFieldChrome({ focused: visible, error: !!error });

  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint="Opens payment methods"
        accessibilityState={{ selected: selected !== null }}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          fieldStyles.box,
          styles.trigger,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}>
        <MethodMark option={selected} selected={false} />
        <View style={styles.triggerText}>
          <Text
            style={[
              styles.methodLabel,
              {
                color: selected ? colors.onSurface : chrome.placeholderColor,
              },
            ]}
            numberOfLines={1}>
            {selected?.label ?? placeholder}
          </Text>
          <Text
            style={[styles.methodSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}>
            {selected?.subtitle ?? "Tap to see available options"}
          </Text>
        </View>
        <Icon name="expand-more" size={22} color={colors.textMuted} />
      </Pressable>
      <FieldMessage error={error} />

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
          {options.map((option, index) => {
            const active = option.value === value;
            const isLast = index === options.length - 1;
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
                  pressed && { backgroundColor: colors.surfaceContainerLow },
                ]}>
                <OptionMark option={option} />
                <View
                  style={[
                    styles.optionBody,
                    !isLast && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.outlineVariant,
                    },
                  ]}>
                  <View style={styles.optionText}>
                    <Text
                      style={[styles.optionLabel, { color: colors.onSurface }]}
                      numberOfLines={1}>
                      {option.label}
                    </Text>
                    {option.subtitle ? (
                      <Text
                        style={[styles.optionSubtitle, { color: colors.onSurfaceVariant }]}
                        numberOfLines={1}>
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Icon name="check-circle" size={22} color={colors.primary} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </FieldWrap>
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

/** Sheet-row leading mark: tinted bubble with the method's icon or artwork. */
function OptionMark({ option }: { option: PaymentMethodOption }) {
  const accent =
    option.tone === "success"
      ? Accent.emerald
      : option.tone === "warning"
        ? Accent.amber
        : Accent.blue;
  if (!option.image) {
    return <IconBubble icon={option.icon ?? "payments"} accent={accent} size={40} />;
  }
  return (
    <View style={[styles.optionMark, { backgroundColor: `${accent}1F` }]}>
      <Image
        source={option.image}
        style={styles.optionImage}
        contentFit="contain"
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Taller trigger for the method mark + two-line layout. */
  trigger: { minHeight: 64, paddingVertical: Spacing.stackSm, gap: Spacing.md },
  triggerText: { flex: 1, minWidth: 0, gap: 2 },
  methodLabel: { ...Typography.bodyMd, fontWeight: "600" },
  methodSubtitle: { ...Typography.bodySmall },
  options: { paddingBottom: Spacing.sm },
  description: { ...Typography.bodySmall, paddingBottom: Spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.md,
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  optionText: { flex: 1, minWidth: 0, gap: 2 },
  optionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  optionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  optionMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optionImage: { width: 26, height: 26 },
  mark: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 42, height: 42 },
});
