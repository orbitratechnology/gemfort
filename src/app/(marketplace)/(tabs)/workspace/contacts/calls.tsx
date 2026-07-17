import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { ScreenInset } from "@/components/ui/form-section";
import { StackHeader } from "@/components/ui/stack-header";
import { CallLogRow } from "@/components/workspace/call-log-row";
import { ContactsHubTabs } from "@/components/workspace/contacts-hub-tabs";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  countMissedCalls,
  type MatchedCallLog,
} from "@/features/workspace/call-logs-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMatchedCallLogs } from "@/hooks/use-matched-call-logs";

export default function ContactCallsScreen() {
  const { colors } = useAppTheme();
  const { logs, access, isLoading, isRefetching, refresh, requestAccess } =
    useMatchedCallLogs({ requestPermissionOnMount: true });
  const missedCount = countMissedCalls(logs);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const unsupported = access?.status === "unsupported";
  const denied = access?.status === "denied";

  const renderItem = useCallback(
    ({ item, index }: { item: MatchedCallLog; index: number }) => (
      <CallLogRow
        log={item}
        isLast={index === logs.length - 1}
        onPress={() => router.push(item.href as never)}
      />
    ),
    [logs.length],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Contacts" />
      <ContactsHubTabs active="calls" missedCount={missedCount} />

      {unsupported ? (
        <ScreenInset style={styles.empty}>
          <EmptyState
            icon="smartphone"
            title="Calls on Android only"
            subtitle="Phone call history sync is available on Android. On iOS, Apple does not allow apps to read the call log."
          />
        </ScreenInset>
      ) : denied ? (
        <ScreenInset style={styles.empty}>
          <EmptyState
            icon="phone"
            title="Allow call history"
            subtitle="Grant call log access so GemFort can match recent calls with your contacts and business profiles."
            action={
              <>
                <Pressable
                  onPress={() => void requestAccess()}
                  style={[styles.cta, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Grant call log access"
                >
                  <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
                    Grant access
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  style={styles.linkBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                >
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    Open Settings
                  </Text>
                </Pressable>
              </>
            }
          />
        </ScreenInset>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <ScreenInset style={styles.empty}>
              <EmptyState
                icon="phone"
                title={isLoading ? "Syncing calls…" : "No matched calls"}
                subtitle={
                  isLoading
                    ? "Reading recent call history from your phone."
                    : "Calls with numbers in your contacts or verified business profiles will appear here."
                }
              />
            </ScreenInset>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  empty: {
    paddingTop: 48,
  },
  cta: {
    marginTop: Spacing.stackSm,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    minHeight: 44,
    justifyContent: "center",
  },
  ctaText: {
    ...Typography.labelMd,
    fontWeight: "700",
  },
  linkBtn: {
    marginTop: 4,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  linkText: {
    ...Typography.labelMd,
    fontWeight: "600",
  },
});
