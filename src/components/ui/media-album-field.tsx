import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import {
  pickLocalMediaMany,
  type LocalMedia,
} from '@/lib/firebase/storage-service';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/providers/toast-provider';

const DEFAULT_MAX = 10;

type MediaAlbumFieldProps = {
  /** Album photos. Index 0 is the primary / cover image. */
  value: LocalMedia[];
  onChange: (photos: LocalMedia[]) => void;
  error?: string;
  max?: number;
  emptyTitle?: string;
  emptySubtitle?: string;
};

/**
 * Multi-image album picker. First item is primary; tap another to promote it.
 * Upload on form submit via uploadLocalMedia().
 */
export function MediaAlbumField({
  value,
  onChange,
  error,
  max = DEFAULT_MAX,
  emptyTitle = 'Add photos',
  emptySubtitle = 'At least 1 required · stored on device until you save',
}: MediaAlbumFieldProps) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const remaining = Math.max(0, max - value.length);

  async function handleAdd() {
    if (remaining <= 0) {
      toast.error(`You can add up to ${max} photos.`);
      return;
    }
    try {
      const picked = await pickLocalMediaMany({
        allows: 'images',
        selectionLimit: remaining,
      });
      if (!picked.length) return;
      haptics.soft();
      onChange([...value, ...picked].slice(0, max));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open photo picker.'));
    }
  }

  function handleRemove(index: number) {
    haptics.light();
    onChange(value.filter((_, i) => i !== index));
  }

  function handleSetPrimary(index: number) {
    if (index <= 0) return;
    haptics.selection();
    const next = [...value];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <View style={styles.wrap}>
      {value.length === 0 ? (
        <Pressable
          onPress={() => void handleAdd()}
          accessibilityRole="button"
          accessibilityLabel={emptyTitle}
          style={({ pressed }) => [
            styles.empty,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: error ? colors.error : colors.outlineVariant,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <Icon name="add-a-photo" size={22} color={colors.onPrimaryContainer} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            {emptyTitle}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            {emptySubtitle}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.grid}>
          {value.map((photo, index) => {
            const isPrimary = index === 0;
            return (
              <View key={`${photo.uri}-${index}`} style={styles.tile}>
                <Pressable
                  onPress={() => handleSetPrimary(index)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPrimary ? 'Primary photo' : 'Set as primary photo'
                  }
                  style={({ pressed }) => [
                    styles.thumbWrap,
                    {
                      borderColor: isPrimary ? colors.primary : colors.outlineVariant,
                      opacity: pressed && !isPrimary ? 0.9 : 1,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  {isPrimary ? (
                    <View
                      style={[
                        styles.primaryBadge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Icon name="star" size={12} color={colors.onPrimary} />
                      <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
                        Primary
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.setPrimaryHint,
                        { backgroundColor: 'rgba(0,0,0,0.55)' },
                      ]}
                    >
                      <Text style={styles.setPrimaryText}>Set primary</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(index)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  style={[
                    styles.removeBtn,
                    { backgroundColor: colors.errorContainer },
                  ]}
                >
                  <Icon name="close" size={16} color={colors.error} />
                </Pressable>
              </View>
            );
          })}

          {remaining > 0 ? (
            <Pressable
              onPress={() => void handleAdd()}
              accessibilityRole="button"
              accessibilityLabel="Add more photos"
              style={({ pressed }) => [
                styles.addTile,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Icon name="add" size={28} color={colors.primary} />
              <Text style={[styles.addLabel, { color: colors.primary }]}>Add</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {value.length > 0 ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {value.length}/{max} · tap a photo to make it primary
        </Text>
      ) : null}

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

const TILE = 104;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  empty: {
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
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...Typography.headlineSmMobile },
  emptySub: { ...Typography.bodySmall, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tile: {
    width: TILE,
    position: 'relative',
  },
  thumbWrap: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  primaryBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  primaryText: { ...Typography.caption, fontWeight: '700' },
  setPrimaryHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    alignItems: 'center',
  },
  setPrimaryText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: { ...Typography.labelMd, fontWeight: '600' },
  meta: { ...Typography.bodySmall },
  error: { ...Typography.bodySmall },
});
