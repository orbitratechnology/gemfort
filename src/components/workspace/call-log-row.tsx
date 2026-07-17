import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  callTypeLabel,
  formatCallDuration,
  type MatchedCallLog,
} from "@/features/workspace/call-logs-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatRelativeTime } from "@/lib/utils";

function typeIcon(type: string): IconName {
  switch (type) {
    case "MISSED":
    case "REJECTED":
      return "phone-missed";
    case "OUTGOING":
      return "call-made";
    case "INCOMING":
      return "call-received";
    default:
      return "call";
  }
}

type CallLogRowProps = {
  log: MatchedCallLog;
  isLast?: boolean;
  /** Hide party avatar/name — for contact/business detail screens. */
  compact?: boolean;
  onPress: () => void;
};

function CallLogRowInner({
  log,
  isLast,
  compact,
  onPress,
}: CallLogRowProps) {
  const { colors } = useAppTheme();
  const missed = log.type === "MISSED" || log.type === "REJECTED";
  const accent = missed ? colors.error : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${log.partyName}, ${callTypeLabel(log.type)}`}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        {
          backgroundColor: colors.surfaceContainerLowest,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {compact ? (
        <View
          style={[
            styles.typeIcon,
            { backgroundColor: accent + "18" },
          ]}
        >
          <Icon name={typeIcon(log.type)} size={18} color={accent} />
        </View>
      ) : (
        <ContactAvatar
          name={log.partyName}
          photoUrl={log.partyPhotoUrl}
          size={40}
        />
      )}
      <View
        style={[
          styles.body,
          compact && styles.bodyCompact,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.top}>
          <Text
            style={[
              compact ? styles.compactTitle : styles.name,
              { color: colors.onSurface },
            ]}
            numberOfLines={1}
            selectable
          >
            {compact ? callTypeLabel(log.type) : log.partyName}
          </Text>
          <Text style={[styles.when, { color: colors.textMuted }]}>
            {formatRelativeTime(new Date(log.dateMs))}
          </Text>
        </View>
        <View style={styles.meta}>
          {!compact ? (
            <>
              <Icon name={typeIcon(log.type)} size={14} color={accent} />
              <Text style={[styles.metaText, { color: accent }]}>
                {callTypeLabel(log.type)}
              </Text>
              <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
            </>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatCallDuration(log.durationSec)}
          </Text>
          {!compact ? (
            <>
              <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
              <Text
                style={[styles.kind, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {log.partyKind === "business" ? "Business" : "Contact"}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
              <Text
                style={[styles.kind, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
                selectable
              >
                {log.number}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const CallLogRow = memo(CallLogRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingLeft: Spacing.containerMargin,
    gap: 12,
  },
  rowCompact: {
    minHeight: 56,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 10,
    paddingRight: Spacing.containerMargin,
    gap: 4,
    minHeight: 64,
  },
  bodyCompact: {
    minHeight: 56,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: "400",
    flex: 1,
  },
  compactTitle: {
    ...Typography.bodyLg,
    fontWeight: "500",
    flex: 1,
  },
  when: {
    ...Typography.caption,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  kind: {
    ...Typography.caption,
    flexShrink: 1,
  },
  dot: {
    ...Typography.caption,
  },
});
