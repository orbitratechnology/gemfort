import { router, type Href } from 'expo-router';

import { pushWithAnchor } from '@/navigation/tab-stack-nav';

type NavigateOptions = {
  /**
   * True when opening from the Notifications inbox screen (covers the tabs).
   * Dismiss the inbox first so NativeTabs stay interactive.
   */
  fromInbox?: boolean;
};

function go(href: Href, options?: NavigateOptions) {
  if (options?.fromInbox && router.canDismiss()) {
    router.dismiss();
    requestAnimationFrame(() => {
      pushWithAnchor(href);
    });
    return;
  }
  pushWithAnchor(href);
}

export function navigateFromNotificationRef(
  refType: string | null | undefined,
  refId: string | null | undefined,
  options?: NavigateOptions,
) {
  const type = String(refType ?? '');
  const id = String(refId ?? '');

  if (type === 'ap' && id) {
    go(`/(marketplace)/(tabs)/workspace/ap/${id}` as Href, options);
    return;
  }
  if (type === 'service' && id) {
    go(`/(marketplace)/(tabs)/workspace/services/${id}` as Href, options);
    return;
  }
  if (type === 'cheque' && id) {
    go(`/(marketplace)/(tabs)/workspace/cheques/${id}` as Href, options);
    return;
  }
  if (type === 'bill' && id) {
    go(`/(marketplace)/(tabs)/workspace/bills/${id}` as Href, options);
    return;
  }
  if (type === 'receivable') {
    go(
      '/(marketplace)/(tabs)/money/receivables' as Href,
      options,
    );
    return;
  }
  if (type === 'verification') {
    go('/profile/verify' as Href, options);
    return;
  }
  if (type === 'announcement') {
    if (options?.fromInbox && router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.navigate('/(marketplace)/(tabs)/home' as Href);
    return;
  }
  if (type === 'listing' && id) {
    go(`/listing/${id}` as Href, options);
    return;
  }
  if (type === 'listing_offer' && id) {
    // Legacy notifications referenced the offer doc; open inbox fallback.
    go('/notifications' as Href, options);
    return;
  }
  if (type === 'account') {
    go('/(marketplace)/profile' as Href, options);
    return;
  }

  if (!options?.fromInbox) {
    router.push('/notifications' as Href);
  }
}
