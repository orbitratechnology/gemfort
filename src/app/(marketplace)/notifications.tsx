import { FlashList } from '@/components/ui/gesture-lists';
import { Redirect, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NotificationRow } from "@/components/notifications/notification-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  notificationVisualFromNotification,
  resolveNotificationVisuals,
} from "@/features/workspace/notification-visuals";
import type { InboxActionId } from "@/features/workspace/notification-presentation";
import {
  respondApCancellation,
  respondApRequest,
} from "@/features/workspace/ap-lifecycle-service";
import { subscribeNotifications } from "@/features/workspace/firestore-subscriptions";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import { navigateFromNotificationRef } from "@/lib/notification-navigation";
import {
  notificationGroupForType,
  type NotificationGroup,
} from "@/lib/notifications/grouping";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { AppNotification } from "@/types";

type NotificationGroupRow = {
  kind: "group";
  group: NotificationGroup;
  notifications: AppNotification[];
};

type NotificationItemRow = {
  kind: "notification";
  notification: AppNotification;
};

type InboxListRow = NotificationGroupRow | NotificationItemRow;

function buildNotificationGroups(
  notifications: AppNotification[],
): NotificationGroupRow[] {
  const groups = new Map<string, NotificationGroupRow>();
  for (const notification of notifications) {
    const group = notificationGroupForType(notification.type);
    const existing = groups.get(group.key);
    if (existing) {
      existing.notifications.push(notification);
    } else {
      groups.set(group.key, { kind: "group", group, notifications: [notification] });
    }
  }
  return [...groups.values()];
}

function HeaderIconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minWidth: 40,
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[] | null>(
    null,
  );

  const {
    data: notifications = [],
    refetch,
    isRefetching,
    isLoading,
  } = useFirestoreLiveQuery({
    queryKey: ["notifications", user?.uid],
    queryFn: () => fetchNotifications(user!.uid),
    subscribe: (onData, onError) =>
      subscribeNotifications(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: visuals = {} } = useQuery({
    queryKey: [
      "notification-visuals",
      user?.uid,
      notifications
        .map(
          (n) =>
            `${n.id}:${n.referenceType}:${n.referenceId}:${n.actorPhotoUrl ?? ""}:${n.imageUrl ?? ""}`,
        )
        .join("|"),
    ],
    queryFn: () => resolveNotificationVisuals(notifications, user!.uid),
    enabled: !!user && notifications.length > 0,
  });

  const unread = notifications.filter((n) => !n.isRead).length;
  const notificationGroups = useMemo(
    () => buildNotificationGroups(notifications),
    [notifications],
  );
  const expandedKeys = useMemo(
    () =>
      new Set(
        expandedGroupKeys ??
          notificationGroups.slice(0, 1).map((g) => g.group.key),
      ),
    [expandedGroupKeys, notificationGroups],
  );
  const inboxRows = useMemo<InboxListRow[]>(
    () =>
      notificationGroups.flatMap((group) => [
        group,
        ...(expandedKeys.has(group.group.key)
          ? group.notifications.map(
              (notification): NotificationItemRow => ({
                kind: "notification",
                notification,
              }),
            )
          : []),
      ]),
    [expandedKeys, notificationGroups],
  );

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setExpandedGroupKeys((current) => {
        const keys = new Set(
          current ?? notificationGroups.slice(0, 1).map((g) => g.group.key),
        );
        if (keys.has(groupKey)) keys.delete(groupKey);
        else keys.add(groupKey);
        return [...keys];
      });
    },
    [notificationGroups],
  );

  const markRead = useCallback(
    async (n: AppNotification) => {
      if (n.isRead) return;
      await markNotificationRead(n.id);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    [queryClient],
  );

  const openNotification = useCallback(
    async (n: AppNotification) => {
      try {
        await markRead(n);
        navigateFromNotificationRef(n.referenceType, n.referenceId, {
          fromInbox: true,
        });
      } catch (e) {
        toast.error(friendlyError(e, "Could not open notification."));
      }
    },
    [markRead, toast],
  );

  const handleAction = useCallback(
    async (n: AppNotification, actionId: InboxActionId) => {
      const key = `${n.id}:${actionId}`;
      try {
        setBusyKey(key);

        if (actionId === "accept_ap" || actionId === "decline_ap") {
          if (!n.referenceId) throw new Error("Missing AP reference.");
          await respondApRequest(
            n.referenceId,
            actionId === "accept_ap" ? "accepted" : "rejected",
          );
          await markRead(n);
          toast.success(
            actionId === "accept_ap" ? "AP accepted" : "AP declined",
          );
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          return;
        }

        if (
          actionId === "accept_ap_cancel" ||
          actionId === "decline_ap_cancel"
        ) {
          if (!n.referenceId) throw new Error("Missing AP reference.");
          await respondApCancellation(
            n.referenceId,
            actionId === "accept_ap_cancel" ? "accepted" : "rejected",
          );
          await markRead(n);
          toast.success(
            actionId === "accept_ap_cancel"
              ? "AP cancelled"
              : "Cancellation declined",
          );
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          return;
        }

        await markRead(n);

        if (actionId === "view_listing") {
          navigateFromNotificationRef("listing", n.referenceId, {
            fromInbox: true,
          });
          return;
        }
        if (actionId === "view_verify") {
          navigateFromNotificationRef("verification", null, {
            fromInbox: true,
          });
          return;
        }
        if (actionId === "view_account") {
          navigateFromNotificationRef("account", null, { fromInbox: true });
          return;
        }

        navigateFromNotificationRef(n.referenceType, n.referenceId, {
          fromInbox: true,
        });
      } catch (e) {
        toast.error(friendlyError(e, "Could not complete that action."));
      } finally {
        setBusyKey(null);
      }
    },
    [markRead, queryClient, toast],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!user || unread === 0) return;
    try {
      await markAllNotificationsRead(user.uid);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All caught up");
    } catch (e) {
      toast.error(friendlyError(e, "Could not mark notifications read."));
    }
  }, [user, unread, queryClient, toast]);

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                marginRight: 4,
              }}
            >
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  unread > 0
                    ? `${unread} unread`
                    : "No unread notifications"
                }
                style={{
                  minWidth: 40,
                  minHeight: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ position: "relative" }}>
                  <Icon
                    name={unread > 0 ? "mark-email-unread" : "mark-email-read"}
                    size={22}
                    color={
                      unread > 0 ? colors.primary : colors.onSurfaceVariant
                    }
                  />
                  {unread > 0 ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -8,
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        backgroundColor: colors.error,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.onError,
                          fontSize: 10,
                          fontWeight: "700",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {unread > 99 ? "99+" : String(unread)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <HeaderIconButton
                label="Mark all as read"
                onPress={handleMarkAllRead}
                disabled={unread === 0}
              >
                <Icon
                  name="done-all"
                  size={22}
                  color={
                    unread > 0 ? colors.primary : colors.onSurfaceVariant
                  }
                />
              </HeaderIconButton>
            </View>
          ),
        }}
      />

      <FlashList
        data={inboxRows}
        getItemType={(item) => item.kind}
        keyExtractor={(item) =>
          item.kind === "group"
            ? `group:${item.group.key}`
            : `notification:${item.notification.id}`
        }
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Spacing.xxl,
        }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.outlineVariant,
              marginLeft: Spacing.containerMargin + 48 + Spacing.md,
            }}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: Spacing.xxl,
              }}
            >
              <Text style={{ ...Typography.bodyMd, color: colors.textMuted }}>
                Loading…
              </Text>
            </View>
          ) : (
            <EmptyState
              icon="notifications-none"
              title="You're all caught up"
              subtitle="Offers, AP requests, cheques, bills, and account alerts show up here."
            />
          )
        }
        renderItem={({ item }) => {
          if (item.kind === "group") {
            const isExpanded = expandedKeys.has(item.group.key);
            const unreadInGroup = item.notifications.filter((n) => !n.isRead)
              .length;
            return (
              <Pressable
                onPress={() => toggleGroup(item.group.key)}
                accessibilityRole="button"
                accessibilityLabel={`${item.group.label}, ${item.notifications.length} notifications${unreadInGroup ? `, ${unreadInGroup} unread` : ""}`}
                accessibilityState={{ expanded: isExpanded }}
                style={({ pressed }) => ({
                  minHeight: 54,
                  paddingHorizontal: Spacing.containerMargin,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sm,
                  backgroundColor: colors.surfaceContainerLow,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon
                  name={isExpanded ? "expand-less" : "expand-more"}
                  size={22}
                  color={colors.primary}
                />
                <Text
                  style={{ ...Typography.labelMd, color: colors.onSurface, flex: 1 }}
                >
                  {item.group.label}
                </Text>
                <Text
                  style={{ ...Typography.labelMd, color: colors.textMuted }}
                >
                  {item.notifications.length}
                </Text>
                {unreadInGroup > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 5,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Text
                      style={{
                        ...Typography.caption,
                        color: colors.onPrimary,
                        fontWeight: "700",
                      }}
                    >
                      {unreadInGroup > 99 ? "99+" : unreadInGroup}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }
          const notification = item.notification;
          const busyActionId =
            busyKey?.startsWith(`${notification.id}:`)
              ? (busyKey.slice(notification.id.length + 1) as InboxActionId)
              : null;
          return (
            <NotificationRow
              notification={notification}
              // Render the notification's persisted avatar/media immediately.
              // The async resolver only adds richer data for older records.
              visual={
                visuals[notification.id] ?? notificationVisualFromNotification(notification)
              }
              onPress={() => openNotification(notification)}
              onAction={(actionId) => handleAction(notification, actionId)}
              busyActionId={busyActionId}
            />
          );
        }}
      />
    </>
  );
}
