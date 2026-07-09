import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  pickLocalMedia,
  type LocalMedia,
  type PickMediaOptions,
} from '@/lib/firebase/storage-service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/providers/toast-provider';

type MediaFieldProps = {
  label?: string;
  hint?: string;
  value: LocalMedia | null;
  onChange: (media: LocalMedia | null) => void;
  /** What the picker may return. Default images. */
  allows?: PickMediaOptions['allows'];
  error?: string;
  /** Empty-state CTA copy */
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Compact row style vs tall preview card */
  variant?: 'card' | 'row';
};

function emptyIcon(allows: PickMediaOptions['allows']): IconName {
  if (allows === 'documents') return 'attach-file';
  if (allows === 'videos') return 'videocam';
  if (allows === 'all') return 'perm-media';
  return 'add-a-photo';
}

function formatBytes(size?: number | null): string | null {
  if (size == null || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Local-first media picker: selects to device cache, shows preview, removable.
 * Remote upload must happen on form submit via uploadLocalMedia().
 */
export function MediaField({
  label,
  hint,
  value,
  onChange,
  allows = 'images',
  error,
  emptyTitle,
  emptySubtitle = 'Stored on device until you save',
  variant = 'card',
}: MediaFieldProps) {
  const { colors } = useAppTheme();
  const toast = useToast();

  async function handlePick() {
    try {
      const media = await pickLocalMedia({ allows });
      if (media) onChange(media);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open media picker.'));
    }
  }

  function handleRemove() {
    onChange(null);
  }

  const title =
    emptyTitle ??
    (allows === 'documents'
      ? 'Add file'
      : allows === 'videos'
        ? 'Add video'
        : allows === 'all'
          ? 'Add media'
          : 'Add photo');

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}

      {value ? (
        variant === 'row' ? (
          <View
            style={[
              styles.rowFilled,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: error ? colors.error : colors.outlineVariant,
              },
            ]}>
            {value.kind === 'image' ? (
              <Image source={{ uri: value.uri }} style={styles.rowThumb} contentFit="cover" />
            ) : (
              <View style={[styles.rowThumb, styles.rowThumbIcon, { backgroundColor: colors.primaryContainer }]}>
                <Icon
                  name={value.kind === 'video' ? 'videocam' : 'description'}
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>
                {value.fileName ?? (value.kind === 'image' ? 'Photo selected' : 'File selected')}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                {formatBytes(value.fileSize) ?? 'Ready to upload on save'}
              </Text>
            </View>
            <Pressable
              onPress={handlePick}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Replace media"
              style={styles.iconBtn}>
              <Icon name="swap-horiz" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable
              onPress={handleRemove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove media"
              style={styles.iconBtn}>
              <Icon name="close" size={20} color={colors.error} />
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.cardFilled,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: error ? colors.error : colors.primary,
              },
            ]}>
            {value.kind === 'image' ? (
              <Image source={{ uri: value.uri }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={[styles.filePreview, { backgroundColor: colors.surfaceContainerLow }]}>
                <Icon
                  name={value.kind === 'video' ? 'videocam' : 'description'}
                  size={36}
                  color={colors.primary}
                />
                <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={2}>
                  {value.fileName ?? 'Selected file'}
                </Text>
                {formatBytes(value.fileSize) ? (
                  <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                    {formatBytes(value.fileSize)}
                  </Text>
                ) : null}
              </View>
            )}
            <View style={styles.cardActions}>
              <Pressable
                onPress={handlePick}
                accessibilityRole="button"
                accessibilityLabel="Replace media"
                style={({ pressed }) => [
                  styles.actionChip,
                  { backgroundColor: colors.surfaceContainerHigh, opacity: pressed ? 0.85 : 1 },
                ]}>
                <Icon name="swap-horiz" size={16} color={colors.onSurface} />
                <Text style={[styles.actionText, { color: colors.onSurface }]}>Replace</Text>
              </Pressable>
              <Pressable
                onPress={handleRemove}
                accessibilityRole="button"
                accessibilityLabel="Remove media"
                style={({ pressed }) => [
                  styles.actionChip,
                  {
                    backgroundColor: colors.errorContainer,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Icon name="delete-outline" size={16} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : (
        <Pressable
          onPress={handlePick}
          accessibilityRole="button"
          accessibilityLabel={title}
          style={({ pressed }) => [
            variant === 'row' ? styles.rowEmpty : styles.cardEmpty,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: error ? colors.error : colors.outlineVariant,
              opacity: pressed ? 0.9 : 1,
            },
          ]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryContainer }]}>
            <Icon name={emptyIcon(allows)} size={22} color={colors.onPrimaryContainer} />
          </View>
          <View style={[styles.emptyText, variant === 'row' && styles.emptyTextRow]}>
            <Text
              style={[
                styles.emptyTitle,
                variant === 'row' && styles.emptyTitleRow,
                { color: colors.onSurface },
              ]}>
              {title}
            </Text>
            <Text
              style={[
                styles.emptySub,
                variant === 'row' && styles.emptySubRow,
                { color: colors.textMuted },
              ]}>
              {emptySubtitle}
            </Text>
          </View>
          {variant === 'row' ? <Icon name="chevron-right" size={20} color={colors.outline} /> : null}
        </Pressable>
      )}

      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { ...Typography.labelMd },
  hint: { ...Typography.bodySmall, marginTop: -4 },
  error: { ...Typography.bodySmall },

  cardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 160,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: Spacing.lg,
  },
  cardFilled: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    overflow: 'hidden',
    gap: 0,
  },
  preview: {
    width: '100%',
    height: 180,
  },
  filePreview: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
  },
  fileName: { ...Typography.bodyMd, fontWeight: '600', textAlign: 'center' },
  fileMeta: { ...Typography.caption },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.sm,
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
  },
  actionText: { ...Typography.labelMd, fontWeight: '600' },

  rowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rowFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 72,
    padding: Spacing.sm,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  rowThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
  },
  rowThumbIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...Typography.labelMd, fontWeight: '600' },
  rowSub: { ...Typography.bodySmall },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { alignItems: 'center', gap: 2 },
  emptyTextRow: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
  emptyTitle: { ...Typography.headlineSmMobile },
  emptyTitleRow: { ...Typography.labelMd, fontWeight: '600' },
  emptySub: { ...Typography.bodySmall, textAlign: 'center' },
  emptySubRow: { textAlign: 'left' },
});
