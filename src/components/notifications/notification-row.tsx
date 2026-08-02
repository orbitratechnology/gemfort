import { Image } from "expo-image";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  getNotificationPresentation,
  type InboxAction,
  type InboxActionId,
  type NotificationTone,
} from "@/features/workspace/notification-presentation";
import type { NotificationVisual } from "@/features/workspace/notification-visuals";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatRelativeTime } from "@/lib/utils";
import type { AppNotification } from "@/types";

type NotificationRowProps = {
  notification: AppNotification;
  visual: NotificationVisual;
  onPress: () => void;
  onAction?: (actionId: InboxActionId) => void | Promise<void>;
  busyActionId?: InboxActionId | null;
};

const AVATAR_SIZE = 48;
const SIDE_MEDIA_SIZE = 52;

function toneColors(
  tone: NotificationTone,
  colors: ReturnType<typeof useAppTheme>["colors"],
) {
  switch (tone) {
    case "critical":
      return {
        accent: colors.error,
        soft: colors.errorContainer,
        onSoft: colors.onErrorContainer,
      };
    case "warning":
      return {
        accent: colors.warningAmber,
        soft: colors.alertWarningBg,
        onSoft: colors.onSurface,
      };
    case "success":
      return {
        accent: colors.successEmerald,
        soft: colors.successEmerald + "22",
        onSoft: colors.successEmerald,
      };
    case "info":
      return {
        accent: colors.primary,
        soft: colors.primaryContainer,
        onSoft: colors.onPrimaryContainer,
      };
    default:
      return {
        accent: colors.onSurfaceVariant,
        soft: colors.surfaceContainer,
        onSoft: colors.onSurfaceVariant,
      };
  }
}

function AvatarWithBadge({
  photoUrl,
  label,
  size,
  badgeIcon,
  badgeTone,
}: {
  photoUrl: string | null;
  label: string;
  size: number;
  badgeIcon: NotificationVisual["fallbackIcon"];
  badgeTone: ReturnType<typeof toneColors>;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ width: size, height: size }}>
      <ContactAvatar name={label || "?"} photoUrl={photoUrl} size={size} />
      <View
        style={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: badgeTone.soft,
          borderWidth: 2,
          borderColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Icon name={badgeIcon} size={11} color={badgeTone.accent} />
      </View>
    </View>
  );
}

function SideMedia({
  uri,
  label,
  size,
}: {
  uri: string;
  label: string;
  size: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === uri) return null;

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: Radius.md,
      }}
      contentFit="cover"
      recyclingKey={uri}
      accessibilityLabel={label}
      onError={() => setFailedUrl(uri)}
    />
  );
}

function ActionChip({
  action,
  onPress,
  busy,
}: {
  action: InboxAction;
  onPress: () => void;
  busy?: boolean;
}) {
  const { colors } = useAppTheme();

  const palette =
    action.variant === "primary"
      ? {
          bg: colors.primary,
          fg: colors.onPrimary,
          border: colors.primary,
        }
      : action.variant === "destructive"
        ? {
            bg: colors.errorContainer,
            fg: colors.onErrorContainer,
            border: colors.errorContainer,
          }
        : action.variant === "ghost"
          ? {
              bg: "transparent",
              fg: colors.primary,
              border: "transparent",
            }
          : {
              bg: colors.surface,
              fg: colors.onSurface,
              border: colors.outlineVariant,
            };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      hitSlop={4}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: Radius.full,
        borderCurve: "continuous",
        backgroundColor: palette.bg,
        borderWidth: action.variant === "secondary" ? 1 : 0,
        borderColor: palette.border,
        opacity: busy ? 0.55 : pressed ? 0.85 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Text
          style={{
            ...Typography.caption,
            fontWeight: "700",
            color: palette.fg,
          }}
        >
          {action.label}
        </Text>
      )}
    </Pressable>
  );
}

function NotificationRowInner({
  notification: n,
  visual,
  onPress,
  onAction,
  busyActionId,
}: NotificationRowProps) {
  const { colors } = useAppTheme();
  const presentation = getNotificationPresentation(n.type);
  const tone = toneColors(presentation.tone, colors);
  const unread = !n.isRead;
  const actor = visual.actorName;
  const isSocial = presentation.layout === "social" && !!actor;
  const isMedia = presentation.layout === "media";
  const showSideMedia = !!visual.mediaUrl;
  const hasActions = presentation.actions.length > 0 && !!onAction;

  return (
    <View
      style={{
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.containerMargin,
        backgroundColor: unread
          ? tone.soft + (tone.soft.length === 7 ? "66" : "")
          : "transparent",
        borderLeftWidth: presentation.layout === "alert" ? 3 : 0,
        borderLeftColor:
          presentation.layout === "alert" ? tone.accent : "transparent",
        gap: hasActions ? 10 : 0,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${n.title}. ${n.message}`}
        accessibilityState={{ selected: unread }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Spacing.md,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <AvatarWithBadge
          photoUrl={visual.imageUrl}
          label={actor || visual.label}
          size={AVATAR_SIZE}
          badgeIcon={presentation.icon}
          badgeTone={tone}
        />

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {isSocial ? (
            <Text
              style={{
                ...Typography.bodyMd,
                color: colors.onSurface,
                lineHeight: 20,
              }}
              numberOfLines={2}
            >
              <Text style={{ fontWeight: unread ? "700" : "600" }}>{actor}</Text>
              {presentation.verb ? (
                <Text
                  style={{ fontWeight: "400", color: colors.onSurfaceVariant }}
                >
                  {` ${presentation.verb}`}
                </Text>
              ) : null}
            </Text>
          ) : (
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
                numberOfLines={2}
              >
                {n.title}
              </Text>
              {unread ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tone.accent,
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
            </View>
          )}

          <Text
            style={{
              ...Typography.bodySmall,
              color: colors.onSurfaceVariant,
              lineHeight: 18,
            }}
            numberOfLines={isMedia ? 3 : 2}
          >
            {n.message}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: Radius.full,
                backgroundColor: tone.soft,
              }}
            >
              <Text
                style={{
                  ...Typography.caption,
                  fontWeight: "700",
                  color: tone.accent,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                {presentation.categoryLabel}
              </Text>
            </View>
            <Text
              style={{
                ...Typography.caption,
                color: colors.textMuted,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatRelativeTime(n.createdAt)}
            </Text>
            {isSocial && unread ? (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: tone.accent,
                  marginLeft: "auto",
                }}
              />
            ) : null}
          </View>
        </View>

        {showSideMedia && visual.mediaUrl ? (
          <SideMedia
            uri={visual.mediaUrl}
            label={n.title}
            size={SIDE_MEDIA_SIZE}
          />
        ) : null}
      </Pressable>

      {hasActions ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingLeft: AVATAR_SIZE + Spacing.md,
          }}
        >
          {presentation.actions.map((action) => (
            <ActionChip
              key={action.id}
              action={action}
              busy={busyActionId === action.id}
              onPress={() => {
                void onAction!(action.id);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const NotificationRow = memo(NotificationRowInner);
