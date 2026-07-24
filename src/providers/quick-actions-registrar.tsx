import * as QuickActions from "expo-quick-actions";
import { useQuickActionCallback } from "expo-quick-actions/hooks";
import { isRouterAction } from "expo-quick-actions/router";
import { router, type Href } from "expo-router";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

import { buildHomeScreenQuickActions } from "@/lib/home-screen-quick-actions";
import { useAuth } from "@/providers/auth-provider";

/**
 * Home-screen quick actions (long-press app icon).
 *
 * Uses `params.href` + Expo Router navigation — same linking model as
 * `expo-quick-actions/router`, with the imperative `router` used elsewhere
 * in GemFort (notifications) so cold starts work from the root providers.
 */
export function QuickActionsRegistrar() {
  const { user, profile, isLoading } = useAuth();

  const onQuickAction = useCallback((action: QuickActions.Action) => {
    if (!isRouterAction(action)) return;
    const href = action.params.href as Href;
    // Defer until navigators are mounted (mirrors expo-quick-actions/router).
    setTimeout(() => {
      router.navigate(href, { withAnchor: true });
    });
  }, []);

  useQuickActionCallback(onQuickAction);

  useEffect(() => {
    if (Platform.OS === "web" || isLoading) return;

    let cancelled = false;

    void (async () => {
      const supported = await QuickActions.isSupported();
      if (!supported || cancelled) return;

      await QuickActions.setItems(
        buildHomeScreenQuickActions(!!user, profile),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, user, profile]);

  return null;
}
