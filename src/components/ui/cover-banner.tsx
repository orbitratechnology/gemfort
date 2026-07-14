import { Image } from "expo-image";
import {
    StyleSheet,
    View,
    type ReactNode,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export const COVER_BANNER_HEIGHT = 168;

type CoverBannerProps = {
  /** Remote or local cover URI. Null/empty shows the placeholder. */
  uri?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Full-bleed cover banner with a branded placeholder when no photo is set.
 * Used on Profile, Edit Business, and public business profiles.
 */
export function CoverBanner({
  uri,
  height = COVER_BANNER_HEIGHT,
  style,
  children,
}: CoverBannerProps) {
  const { colors } = useAppTheme();
  const hasPhoto = !!uri?.trim();

  return (
    <View style={[styles.wrap, { height }, style]}>
      {hasPhoto ? (
        <Image source={{ uri: uri! }} style={styles.image} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: colors.primaryContainer },
          ]}
          accessibilityLabel="Cover photo placeholder"
        >
          <View
            style={[
              styles.blob,
              styles.blobA,
              { backgroundColor: colors.primary + "22" },
            ]}
          />
          <View
            style={[
              styles.blob,
              styles.blobB,
              { backgroundColor: colors.onPrimaryContainer + "14" },
            ]}
          />
          <View style={styles.placeholderIcon}>
            <Icon
              name="diamond"
              size={40}
              color={colors.onPrimaryContainer + "55"}
            />
          </View>
          <View style={styles.motifRow}>
            <View
              style={[
                styles.motifDot,
                { backgroundColor: colors.onPrimaryContainer + "28" },
              ]}
            />
            <View
              style={[
                styles.motifDot,
                { backgroundColor: colors.onPrimaryContainer + "18" },
              ]}
            />
            <View
              style={[
                styles.motifDot,
                { backgroundColor: colors.onPrimaryContainer + "28" },
              ]}
            />
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobA: {
    width: 220,
    height: 220,
    top: -70,
    right: -50,
  },
  blobB: {
    width: 160,
    height: 160,
    bottom: -40,
    left: -30,
  },
  placeholderIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  motifRow: {
    position: "absolute",
    bottom: Spacing.md,
    flexDirection: "row",
    gap: 8,
  },
  motifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
