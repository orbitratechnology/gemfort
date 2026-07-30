import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useUnreadListingOfferCount } from "@/hooks/use-unread-listing-offers";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";
import { MONEY_HUB, WORKSPACE_HUB } from "@/navigation/tab-stack-nav";

export default function MarketplaceTabLayout() {
  const { colors } = useAppTheme();
  const unread = useUnreadNotificationCount();
  const unreadOffers = useUnreadListingOfferCount();

  return (
    <NativeTabs
      key={colors.text}
      indicatorColor={colors.primary}
      iconColor={{ default: colors.textMuted, selected: colors.onPrimary }}
      tintColor={colors.primary}
      backgroundColor={colors.tabBar}
      minimizeBehavior={Platform.OS === "ios" ? "onScrollDown" : undefined}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        {unread > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unread > 99 ? "99+" : String(unread)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="market">
        <NativeTabs.Trigger.Icon
          sf={{ default: "building.2", selected: "building.2.fill" }}
          md="storefront"
        />
        <NativeTabs.Trigger.Label>Market</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="workspace"
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Re-tap while focused: always return to the Workspace hub.
            // Native popToTop is a no-op when a nested screen was opened as
            // the stack root (cross-tab push without withAnchor).
            if (navigation.isFocused()) {
              router.navigate(WORKSPACE_HUB);
            }
          },
        })}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "diamond", selected: "diamond.fill" }}
          md="diamond"
        />
        <NativeTabs.Trigger.Label>Workspace</NativeTabs.Trigger.Label>
        {unreadOffers > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unreadOffers > 99 ? "99+" : String(unreadOffers)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="money"
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              router.navigate(MONEY_HUB);
            }
          },
        })}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "banknote", selected: "banknote.fill" }}
          md="payments"
        />
        <NativeTabs.Trigger.Label>Money</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
