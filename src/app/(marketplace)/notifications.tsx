import { Redirect, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NotificationRow } from "@/components/notifications/notification-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  resolveNotificationVisuals,
  type NotificationVisual,
} from "@/features/workspace/notification-visuals";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { navigateFromNotificationRef } from "@/lib/notification-navigation";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { AppNotification } from "@/types";

const EMPTY_VISUAL: NotificationVisual = {
  imageUrl: null,
  shape: "circle",
  label: "?",
  fallbackIcon: "notifications",
};

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

  const {
    data: notifications = [],
    refetch,
    isRefetching,
    isLoading,
  } = useQuery({
    queryKey: ["notifications", user?.uid],
    queryFn: () => fetchNotifications(user!.uid),
    enabled: !!user,
  });

  const { data: visuals = {} } = useQuery({
    queryKey: [
      "notification-visuals",
      user?.uid,
      notifications
        .map((n) => `${n.id}:${n.referenceType}:${n.referenceId}`)
        .join("|"),
    ],
    queryFn: () => resolveNotificationVisuals(notifications, user!.uid),
    enabled: !!user && notifications.length > 0,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const handleTap = useCallback(
    async (n: AppNotification) => {
      try {
        if (!n.isRead) {
          await markNotificationRead(n.id);
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
        navigateFromNotificationRef(n.referenceType, n.referenceId, {
          fromInbox: true,
        });
      } catch (e) {
        toast.error(friendlyError(e, "Could not open notification."));
      }
    },
    [queryClient, toast],
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

      <FlatList
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
              subtitle="Alerts about AP, cheques, bills, and payments show up here."
            />
          )
        }
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            visual={visuals[item.id] ?? EMPTY_VISUAL}
            onPress={() => handleTap(item)}
          />
        )}
      />
    </>
  );
}
