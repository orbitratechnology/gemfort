import { Image } from "expo-image";
import { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
    bankLogoUrls,
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

function BankAvatarInner({
  bank,
  size = 40,
}: {
  bank: SriLankaBank;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const urls = useMemo(
    () => bankLogoUrls(bank, Math.max(size * 2, 128)),
    [bank, size],
  );
  const [urlIndex, setUrlIndex] = useState(0);

  const uri = urls[urlIndex] ?? null;
  const initial = (bank.shortName || bank.name).charAt(0).toUpperCase();
  const radius = Math.round(size / 4);

  if (!uri) {
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
        key={`${bank.code}-${urlIndex}`}
        source={{ uri }}
        style={{ width: size * 0.72, height: size * 0.72 }}
        contentFit="contain"
        recyclingKey={`${bank.code}-${urlIndex}`}
        onError={() => {
          setUrlIndex((i) => (i + 1 < urls.length ? i + 1 : urls.length));
        }}
      />
    </View>
  );
}

export function BankAvatar({
  bank,
  size = 40,
}: {
  bank: SriLankaBank;
  size?: number;
}) {
  return <BankAvatarInner key={bank.code} bank={bank} size={size} />;
}

/** Universal searchable Sri Lankan bank picker (static directory). */
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
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search bank or code…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
                {
                  backgroundColor: selected
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: selected
                    ? colors.primary
                    : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <BankAvatar bank={item} size={44} />
              <View style={styles.rowBody}>
                <Text
                  style={[styles.name, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.meta, { color: colors.textMuted }]}
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

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          bank ? `${bank.name}, code ${bank.code}` : placeholder
        }
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.error : colors.outlineVariant,
            opacity: pressed ? 0.92 : 1,
          },
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
            <View
              style={[
                styles.fieldIcon,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Icon name="account-balance" size={18} color={colors.outline} />
            </View>
            <Text style={[styles.placeholder, { color: colors.outline }]}>
              {placeholder}
            </Text>
          </>
        )}
        <Icon name="expand-more" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
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

      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search branch…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.bankID}-${item.ID}`}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
                {
                  backgroundColor: selected
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: selected
                    ? colors.primary
                    : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.branchIcon,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Icon name="place" size={18} color={colors.onSurfaceVariant} />
              </View>
              <View style={styles.rowBody}>
                <Text
                  style={[styles.name, { color: colors.onSurface }]}
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

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={displayName || placeholder}
        disabled={locked}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.error : colors.outlineVariant,
            opacity: locked ? 0.5 : pressed ? 0.92 : 1,
          },
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
            <View
              style={[
                styles.fieldIcon,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Icon name="business" size={18} color={colors.outline} />
            </View>
            <Text style={[styles.placeholder, { color: colors.outline }]}>
              {!bankCode
                ? "Select a bank first"
                : !hasList
                  ? "No branch list for this bank"
                  : placeholder}
            </Text>
          </>
        )}
        <Icon name="expand-more" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    marginBottom: Spacing.stackMd,
  },
  searchInput: { flex: 1, ...Typography.bodyMd, paddingVertical: 0 },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingBottom: Spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    minHeight: 64,
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
  branchIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  fieldWrap: { gap: Spacing.stackSm },
  fieldLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldBody: { flex: 1, minWidth: 0, gap: 2 },
  placeholder: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.bodySmall },
});
