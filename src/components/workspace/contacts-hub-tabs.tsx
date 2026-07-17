import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { ScreenInset } from "@/components/ui/form-section";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

const CONTACTS_HREF = "/(marketplace)/(tabs)/workspace/contacts";
const CALLS_HREF = "/(marketplace)/(tabs)/workspace/contacts/calls";

type TabId = "contacts" | "calls";

type ContactsHubTabsProps = {
  active: TabId;
  /** Missed / rejected call count for the Calls tab badge. */
  missedCount?: number;
};

const TABS: {
  id: TabId;
  label: string;
  icon: IconName;
  href: string;
}[] = [
  {
    id: "contacts",
    label: "Contacts",
    icon: "people",
    href: CONTACTS_HREF,
  },
  {
    id: "calls",
    label: "Calls",
    icon: "phone",
    href: CALLS_HREF,
  },
];

/** Contacts ↔ Calls switcher — matches Money period segment sizing. */
export function ContactsHubTabs({
  active,
  missedCount = 0,
}: ContactsHubTabsProps) {
  const { colors } = useAppTheme();

  return (
    <ScreenInset style={styles.wrap}>
      <View
        style={[
          styles.segment,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          const showBadge = tab.id === "calls" && missedCount > 0;
          const badgeLabel =
            missedCount > 99 ? "99+" : String(Math.max(0, missedCount));

          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                if (!selected) router.replace(tab.href as never);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                showBadge
                  ? `${tab.label}, ${missedCount} missed`
                  : tab.label
              }
              style={({ pressed }) => [
                styles.segmentBtn,
                selected && {
                  backgroundColor: colors.surfaceContainerLowest,
                },
                pressed && !selected && { opacity: 0.85 },
              ]}
            >
              <View style={styles.iconWrap}>
                <Icon
                  name={tab.icon}
                  size={20}
                  color={selected ? colors.primary : colors.onSurfaceVariant}
                />
                {showBadge ? (
                  <View
                    style={[styles.badge, { backgroundColor: colors.error }]}
                  >
                    <Text
                      style={[styles.badgeText, { color: colors.onError }]}
                    >
                      {badgeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: selected
                      ? colors.primary
                      : colors.onSurfaceVariant,
                    fontWeight: selected ? "700" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenInset>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.stackMd,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    ...Typography.labelMd,
    fontSize: 15,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 12,
  },
});
