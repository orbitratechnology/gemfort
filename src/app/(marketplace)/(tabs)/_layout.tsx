import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useUnreadNotificationCount } from '@/hooks/use-unread-notifications';

export default function MarketplaceTabLayout() {
  const { colors } = useAppTheme();
  const unread = useUnreadNotificationCount();

  return (
    <NativeTabs
      key={colors.text}
      indicatorColor={colors.primary}
      iconColor={{ default: colors.text, selected: colors.white }}
      tintColor={colors.text}
      backgroundColor={colors.tabBar}
      minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        {unread > 0 ? (
          <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="directory">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'building.2', selected: 'building.2.fill' }}
          md="storefront"
        />
        <NativeTabs.Trigger.Label>Directory</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workspace">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'diamond', selected: 'diamond.fill' }}
          md="diamond"
        />
        <NativeTabs.Trigger.Label>Workspace</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
