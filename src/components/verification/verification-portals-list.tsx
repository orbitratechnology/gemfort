import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlatList } from "@/components/ui/gesture-lists";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  VERIFICATION_LIST_ITEMS,
  type VerificationLab,
  type VerificationListItem,
} from "@/constants/verification-portals";
import {
  websiteFaviconUrls,
  websiteHostname,
} from "@/features/marketplace/business-links";
import { useAppTheme } from "@/hooks/use-app-theme";

function LabFavicon({ lab }: { lab: VerificationLab }) {
  const { colors } = useAppTheme();
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const host = websiteHostname(lab.url);
  const candidates = useMemo(() => websiteFaviconUrls(lab.url, 64), [lab.url]);
  const source = failed ? undefined : candidates[candidateIndex];

  return (
    <View
      style={[styles.favicon, { backgroundColor: colors.surfaceContainerHigh }]}
    >
      {source ? (
        <Image
          key={`${lab.url}-${candidateIndex}`}
          source={{ uri: source }}
          style={styles.faviconImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`verification-favicon-${host ?? lab.name}-${candidateIndex}`}
          onError={() => {
            if (candidateIndex < candidates.length - 1) {
              setCandidateIndex((index) => index + 1);
            } else {
              setFailed(true);
            }
          }}
        />
      ) : (
        <Text style={[styles.faviconMark, { color: colors.primary }]}>
          {lab.mark.slice(0, 2)}
        </Text>
      )}
    </View>
  );
}

async function openVerificationPortal(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

function VerificationListItemView({ item }: { item: VerificationListItem }) {
  const { colors } = useAppTheme();

  if (item.type === "heading") {
    return (
      <View style={styles.groupHeading}>
        <Icon
          name={item.icon === "flag" ? "flag" : "language"}
          size={17}
          color={colors.textMuted}
        />
        <View style={styles.groupHeadingCopy}>
          <Text style={[styles.groupHeadingText, { color: colors.textMuted }]}>
            {item.title}
          </Text>
          <Text style={[styles.groupSubtitle, { color: colors.textMuted }]}>
            {item.subtitle}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.labSurface,
        { backgroundColor: colors.surfaceContainerLowest },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${item.lab.name} verification portal`}
        accessibilityHint="Opens the laboratory verification page"
        onPress={() => void openVerificationPortal(item.lab.url)}
        style={({ pressed }) => [
          styles.labRow,
          !item.firstInGroup && {
            borderTopColor: colors.outlineVariant,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          { opacity: pressed ? 0.68 : 1 },
        ]}
      >
        <LabFavicon lab={item.lab} />
        <View style={styles.labCopy}>
          <Text style={[styles.labName, { color: colors.onSurface }]} selectable>
            {item.lab.name}
          </Text>
          <Text
            style={[styles.labUrl, { color: colors.textMuted }]}
            numberOfLines={1}
            selectable
          >
            {websiteHostname(item.lab.url) ?? item.lab.url}
          </Text>
          {item.lab.requiredInfo ? (
            <Text
              style={[styles.labRequirement, { color: colors.onSurfaceVariant }]}
              selectable
            >
              Needs: {item.lab.requiredInfo}
            </Text>
          ) : null}
        </View>
        <Icon name="open-in-new" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export function VerificationPortalsList() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <FlatList<VerificationListItem>
      data={VERIFICATION_LIST_ITEMS}
      renderItem={({ item }) => <VerificationListItemView item={item} />}
      keyExtractor={(item) => item.id}
      style={[styles.list, { backgroundColor: colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator
      contentContainerStyle={{
        backgroundColor: colors.background,
        paddingBottom: Math.max(insets.bottom, Spacing.md),
      }}
      ListHeaderComponent={<StackHeader title="Verification portals" closeIcon />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  groupHeadingCopy: { flex: 1, gap: 2 },
  groupHeadingText: { ...Typography.labelMd, letterSpacing: 0.7 },
  groupSubtitle: { ...Typography.caption },
  labSurface: { width: "100%" },
  labRow: {
    minHeight: 76,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  favicon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faviconImage: { width: 30, height: 30 },
  faviconMark: { ...Typography.caption, fontWeight: "700", fontSize: 10 },
  labCopy: { flex: 1, gap: 2 },
  labName: { ...Typography.bodyMd, fontWeight: "600" },
  labUrl: { ...Typography.caption },
  labRequirement: { ...Typography.caption, lineHeight: 17 },
});
