import { Image } from "expo-image";
import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import type { NotificationVisual } from "@/features/workspace/notification-visuals";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatRelativeTime } from "@/lib/utils";
import type { AppNotification } from "@/types";

type NotificationRowProps = {
  notification: AppNotification;
  visual: NotificationVisual;
  onPress: () => void;
};

function typeLabel(type: string): string {
  if (type.startsWith("ap_")) return "AP";
  if (type.startsWith("cheque_")) return "Cheque";
  if (type.startsWith("bill_")) return "Bill";
  if (type.startsWith("service_")) return "Service";
  if (type.startsWith("payment_")) return "Payment";
  if (type.startsWith("verification_")) return "Verification";
  if (type.startsWith("announcement_")) return "News";
  if (type.startsWith("cert_")) return "Certificate";
  if (type.startsWith("report_")) return "Report";
  if (type.startsWith("account_")) return "Account";
  return "Alert";
}

function MediaThumb({
  visual,
  size,
}: {
  visual: NotificationVisual;
  size: number;
}) {
  const { colors } = useAppTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!visual.imageUrl && failedUrl !== visual.imageUrl;
  const radius =
    visual.shape === "circle" ? size / 2 : Radius.md;

  if (showImage && visual.shape === "circle") {
    return (
      <ContactAvatar
        name={visual.label}
        photoUrl={visual.imageUrl}
        size={size}
      />
    );
  }

  if (showImage) {
    return (
      <Image
        source={{ uri: visual.imageUrl! }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        recyclingKey={visual.imageUrl!}
        accessibilityLabel={visual.label}
        onError={() => setFailedUrl(visual.imageUrl)}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryContainer,
      }}
    >
      <Icon
        name={visual.fallbackIcon}
        size={Math.round(size * 0.42)}
        color={colors.onPrimaryContainer}
      />
    </View>
  );
}

function NotificationRowInner({
  notification: n,
  visual,
  onPress,
}: NotificationRowProps) {
  const { colors } = useAppTheme();
  const unread = !n.isRead;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.message}`}
      accessibilityState={{ selected: unread }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Spacing.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.containerMargin,
          backgroundColor: unread
            ? colors.primaryContainer + "55"
            : "transparent",
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <MediaThumb visual={visual} size={48} />

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              ...Typography.bodyMd,
              fontWeight: unread ? "700" : "600",
              color: colors.onSurface,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {n.title}
          </Text>
          {unread ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </View>

        <Text
          style={{
            ...Typography.bodySmall,
            color: colors.onSurfaceVariant,
            lineHeight: 18,
          }}
          numberOfLines={2}
        >
          {n.message}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}
        >
          <Text
            style={{
              ...Typography.caption,
              fontWeight: "600",
              color: colors.primary,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            {typeLabel(n.type)}
          </Text>
          <Text style={{ ...Typography.caption, color: colors.outline }}>
            ·
          </Text>
          <Text
            style={{
              ...Typography.caption,
              color: colors.textMuted,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatRelativeTime(n.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const NotificationRow = memo(NotificationRowInner);
