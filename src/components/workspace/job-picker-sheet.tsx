import { FlashList } from '@/components/ui/gesture-lists';
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomSheet, SheetListSeparator } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LapidaryJob } from "@/types";

const JOB_STATUS_LABELS: Record<LapidaryJob["status"], string> = {
  queued: "Queued",
  in_progress: "In progress",
  ready: "Ready",
  returned: "Returned",
  cancelled: "Cancelled",
};

type JobPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  jobs: LapidaryJob[];
  value: string;
  onSelect: (job: LapidaryJob) => void;
  title?: string;
  emptyHint?: string;
};

function matchesQuery(job: LapidaryJob, q: string) {
  if (!q) return true;
  const hay = [
    job.gemName,
    job.gemId,
    job.status,
    JOB_STATUS_LABELS[job.status],
    ...(job.serviceTypes ?? []),
    job.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Searchable bottom sheet to link a lapidary job to a bill. */
export function JobPickerSheet({
  visible,
  onClose,
  jobs,
  value,
  onSelect,
  title = "Select job",
  emptyHint = "Accept a service request first to create a job.",
}: JobPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery("");
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return jobs.filter(
      (j) => j.status !== "cancelled" && matchesQuery(j, q),
    );
  }, [jobs, debouncedQuery]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scrollable={false}>
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.surfaceContainerHigh },
        ]}
      >
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search jobs"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.onSurface }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="handyman"
          title="No jobs"
          subtitle={emptyHint}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={SheetListSeparator}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = item.id === value;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: selected
                      ? colors.primaryContainer
                      : colors.surfaceContainerLowest,
                    borderColor: selected
                      ? colors.primary
                      : colors.outlineVariant,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[styles.title, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {item.gemName || "Gem job"}
                  </Text>
                  <Text
                    style={[styles.sub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {JOB_STATUS_LABELS[item.status]}
                    {item.serviceTypes?.length
                      ? ` · ${item.serviceTypes.join(", ")}`
                      : ""}
                  </Text>
                </View>
                {selected ? (
                  <Icon name="check-circle" size={22} color={colors.primary} />
                ) : (
                  <Icon name="chevron-right" size={20} color={colors.textMuted} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
}

type JobSelectFieldProps = {
  label: string;
  job: LapidaryJob | null;
  placeholder?: string;
  onPress: () => void;
  onClear?: () => void;
  error?: string;
};

/** Compact field that opens JobPickerSheet. */
export function JobSelectField({
  label,
  job,
  placeholder = "Select a job",
  onPress,
  onClear,
  error,
}: JobSelectFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={job ? `Selected job ${job.gemName}` : placeholder}
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
        {job ? (
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[styles.fieldTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {job.gemName || "Gem job"}
            </Text>
            <Text
              style={[styles.fieldSub, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {JOB_STATUS_LABELS[job.status]}
              {job.serviceTypes?.length
                ? ` · ${job.serviceTypes.join(", ")}`
                : ""}
            </Text>
          </View>
        ) : (
          <Text style={[styles.placeholder, { color: colors.textMuted }]}>
            {placeholder}
          </Text>
        )}
        {job && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityLabel="Clear job"
          >
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Icon name="expand-more" size={22} color={colors.textMuted} />
        )}
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

export { JOB_STATUS_LABELS };

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: 4,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { ...Typography.bodyMd, fontWeight: "600" },
  sub: { ...Typography.caption },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { ...Typography.labelMd, fontWeight: "600" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldTitle: { ...Typography.bodyMd, fontWeight: "600" },
  fieldSub: { ...Typography.caption },
  placeholder: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.caption },
});
