import { Image } from "expo-image";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { GemCertificate } from "@/types";

const CERTIFICATE_GOLD = "#D4AF37";
const CERTIFICATE_BLACK = "#171717";

export function GemCertificateBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessibilityLabel="Certified gem"
      style={[styles.badge, compact && styles.badgeCompact]}
    >
      <Icon
        name="workspace-premium"
        size={compact ? 13 : 15}
        color={CERTIFICATE_BLACK}
      />
      {!compact ? <Text style={styles.badgeText}>Certified</Text> : null}
    </View>
  );
}

export function GemCertificateCard({
  certificate,
}: {
  certificate: GemCertificate;
}) {
  const { colors } = useAppTheme();
  const isImage =
    certificate.kind === "image" || certificate.mimeType?.startsWith("image/");
  const fileLabel = certificate.fileName?.trim() || (isImage ? "Certificate photo" : "Certificate document");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open gem certificate, ${fileLabel}`}
      accessibilityHint="Opens the certificate image or document"
      onPress={() => void Linking.openURL(certificate.url)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {isImage ? (
        <Image
          source={{ uri: certificate.url }}
          style={styles.preview}
          contentFit="cover"
          recyclingKey={certificate.url}
          accessibilityLabel="Gem certificate preview"
        />
      ) : (
        <View
          style={[styles.filePreview, { backgroundColor: colors.surfaceContainerLow }]}
        >
          <Icon name="description" size={30} color={CERTIFICATE_GOLD} />
          <Text
            style={[styles.fileName, { color: colors.onSurface }]}
            numberOfLines={2}
          >
            {fileLabel}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <GemCertificateBadge compact />
          <Text style={[styles.title, { color: colors.onSurface }]}>
            Gem certificate
          </Text>
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {fileLabel} · Tap to open
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: CERTIFICATE_BLACK,
    backgroundColor: CERTIFICATE_GOLD,
  },
  badgeCompact: {
    gap: 0,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeText: {
    ...Typography.caption,
    color: CERTIFICATE_BLACK,
    fontWeight: "800",
  },
  card: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  preview: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  filePreview: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    padding: 5,
  },
  fileName: {
    ...Typography.caption,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
    ...Typography.bodyMd,
    fontWeight: "800",
    flexShrink: 1,
  },
  meta: {
    ...Typography.caption,
  },
});
