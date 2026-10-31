import { FlashList } from '@/components/ui/gesture-lists';
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Accent, IconBubble } from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from "@/components/ui/field-chrome";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { bankLogo } from "@/constants/bank-logos";
import {
    filterBanks,
    getBankByCode,
    getBankByName,
    type SriLankaBank,
} from "@/constants/sri-lanka-banks";
import {
    bankHasBranches,
    filterBranches,
    findBranchByName,
    type SriLankaBranch,
} from "@/constants/sri-lanka-branches";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type BankPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string | null;
  onSelect: (bank: SriLankaBank) => void;
  title?: string;
};

export function BankAvatar({
  bank,
  size = 40,
}: {
  bank: SriLankaBank;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const logo = bankLogo(bank);
  const initial = (bank.shortName || bank.name).charAt(0).toUpperCase();
  const radius = Math.round(size / 4);

  if (!logo) {
    return (
      <View
        style={[
          styles.avatarFallback,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.primaryContainer,
          },
        ]}
      >
        <Text
          style={[
            styles.avatarInitial,
            { color: colors.onPrimaryContainer, fontSize: size * 0.38 },
          ]}
        >
          {initial}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.avatarWrap,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <Image
        source={logo}
        style={{ width: size * 0.72, height: size * 0.72 }}
        contentFit="contain"
        recyclingKey={bank.code}
      />
    </View>
  );
}

/** Hairline between sheet list rows, inset past the 40dp leading mark. */
function RowDivider() {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]}
    />
  );
}

/** Universal searchable Sri Lankan bank picker (static list). */
export function BankPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
  title = "Select bank",
}: BankPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const filtered = useMemo(() => filterBanks(debouncedQuery), [debouncedQuery]);

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={title}
      scrollable={false}
    >
      <SearchField
        style={styles.search}
        placeholder="Search bank or code…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={RowDivider}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="account-balance"
            title="No matches"
            subtitle="Try another name or bank code."
          />
        }
        renderItem={({ item }) => {
          const selected = value === item.code;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.name}, code ${item.code}`}
              onPress={() => {
                onSelect(item);
                setQuery("");
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <BankAvatar bank={item} size={40} />
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {item.shortName} · Code {item.code}
                </Text>
              </View>
              {selected ? (
                <Icon name="check-circle" size={22} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

type BankSelectFieldProps = {
  label: string;
  bankCode: string | null;
  bankName?: string | null;
  placeholder?: string;
  onPress: () => void;
  error?: string;
};

/** Compact field that opens BankPickerSheet. */
export function BankSelectField({
  label,
  bankCode,
  bankName,
  placeholder = "Search Sri Lankan banks…",
  onPress,
  error,
}: BankSelectFieldProps) {
  const { colors } = useAppTheme();
  const bank =
    getBankByCode(bankCode) ?? getBankByName(bankName ?? undefined) ?? null;
  const chrome = useFieldChrome({ error: !!error });

  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          bank ? `${bank.name}, code ${bank.code}` : placeholder
        }
        onPress={onPress}
        style={({ pressed }) => [
          fieldStyles.box,
          styles.field,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}
      >
        {bank ? (
          <>
            <BankAvatar bank={bank} size={40} />
            <View style={styles.fieldBody}>
              <Text
                style={[styles.name, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {bank.name}
              </Text>
              <Text
                style={[styles.meta, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {bank.shortName} · {bank.code}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Icon name="account-balance" size={20} color={chrome.iconColor} />
            <Text style={[fieldStyles.value, { color: chrome.placeholderColor }]}>
              {placeholder}
            </Text>
          </>
        )}
        <Icon name="expand-more" size={22} color={colors.textMuted} />
      </Pressable>
      <FieldMessage error={error} />
    </FieldWrap>
  );
}

type BranchPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  bankCode: string | null;
  /** Selected branch name */
  value: string | null;
  onSelect: (branch: SriLankaBranch) => void;
  title?: string;
};

/** Searchable branch list for the currently selected bank. */
export function BranchPickerSheet({
  visible,
  onClose,
  bankCode,
  value,
  onSelect,
  title = "Select branch",
}: BranchPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const bank = getBankByCode(bankCode) ?? null;
  const filtered = useMemo(
    () => filterBranches(bankCode, debouncedQuery),
    [bankCode, debouncedQuery],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={title}
      scrollable={false}
    >
      {bank ? (
        <View style={styles.bankHint}>
          <BankAvatar bank={bank} size={32} />
          <Text
            style={[styles.bankHintText, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {bank.name}
          </Text>
        </View>
      ) : null}

      <SearchField
        style={styles.search}
        placeholder="Search branch…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      <FlashList
        data={filtered}
        keyExtractor={(item) => `${item.bankID}-${item.ID}`}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={RowDivider}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="business"
            title={bankCode ? "No branches found" : "Select a bank first"}
            subtitle={
              bankCode
                ? "Try another search."
                : "Choose a bank to load its branches."
            }
          />
        }
        renderItem={({ item }) => {
          const selected =
            value?.trim().toLowerCase() === item.name.toLowerCase();
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.name}
              onPress={() => {
                onSelect(item);
                setQuery("");
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <IconBubble icon="place" accent={Accent.slate} size={40} />
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowTitle, { color: colors.onSurface }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
              </View>
              {selected ? (
                <Icon name="check-circle" size={22} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

type BranchSelectFieldProps = {
  label: string;
  bankCode: string | null;
  branchName: string | null;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
};

/** Compact field that opens BranchPickerSheet; shows bank logo when a branch is set. */
export function BranchSelectField({
  label,
  bankCode,
  branchName,
  placeholder = "Select branch…",
  onPress,
  error,
  disabled,
}: BranchSelectFieldProps) {
  const { colors } = useAppTheme();
  const bank = getBankByCode(bankCode) ?? null;
  const branch = findBranchByName(bankCode, branchName) ?? null;
  const hasList = bankHasBranches(bankCode);
  const locked = disabled || !bankCode || !hasList;
  const displayName = branch?.name ?? branchName?.trim() ?? "";
  const chrome = useFieldChrome({ error: !!error, disabled: locked });

  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={displayName || placeholder}
        disabled={locked}
        onPress={onPress}
        style={({ pressed }) => [
          fieldStyles.box,
          styles.field,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}
      >
        {bank && displayName ? (
          <>
            <BankAvatar bank={bank} size={40} />
            <View style={styles.fieldBody}>
              <Text
                style={[styles.name, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <Text
                style={[styles.meta, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {bank.shortName}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Icon name="business" size={20} color={chrome.iconColor} />
            <Text style={[fieldStyles.value, { color: chrome.placeholderColor }]}>
              {!bankCode
                ? "Select a bank first"
                : !hasList
                  ? "No branch list for this bank"
                  : placeholder}
            </Text>
          </>
        )}
        <Icon name="expand-more" size={22} color={colors.textMuted} />
      </Pressable>
      <FieldMessage error={error} />
    </FieldWrap>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: Spacing.stackMd },
  list: { flex: 1 },
  listContent: { paddingBottom: Spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  rowTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rowMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontWeight: "700" },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...Typography.labelMd, fontWeight: "700" },
  meta: { ...Typography.caption, fontVariant: ["tabular-nums"] },

  bankHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.stackSm,
  },
  bankHintText: { ...Typography.bodySmall, flex: 1, fontWeight: "600" },

  /** Bank/branch fields show a logo and two lines, so they sit taller. */
  field: { minHeight: 64, paddingVertical: Spacing.sm },
  fieldBody: { flex: 1, minWidth: 0, gap: 2 },
});
