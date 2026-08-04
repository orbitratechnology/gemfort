import { FlashList } from '@/components/ui/gesture-lists';
import { Redirect, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, type ReactNode } from "react";
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
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { AppNotification } from "@/types";

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
        data={notifications}
        keyExtractor={(n) => n.id}
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
          const busyActionId =
            busyKey?.startsWith(`${item.id}:`)
              ? (busyKey.slice(item.id.length + 1) as InboxActionId)
              : null;
          return (
            <NotificationRow
              notification={item}
              // Render the notification's persisted avatar/media immediately.
              // The async resolver only adds richer data for older records.
              visual={
                visuals[item.id] ?? notificationVisualFromNotification(item)
              }
              onPress={() => openNotification(item)}
              onAction={(actionId) => handleAction(item, actionId)}
              busyActionId={busyActionId}
            />
          );
        }}
      />
    </>
  );
}
