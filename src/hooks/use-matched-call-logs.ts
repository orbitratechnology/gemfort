import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  ensureCallLogPermission,
  fetchMatchedCallLogs,
} from "@/features/workspace/call-logs-service";
import { fetchContacts } from "@/features/workspace/workspace-service";
import { useAuth } from "@/providers/auth-provider";

/**
 * Auto-syncs Android call logs with workspace contacts + verified businesses.
 * Refetches when the app returns to foreground (if permission already granted).
 */
export function useMatchedCallLogs(options?: {
  enabled?: boolean;
  /** Prompt for READ_CALL_LOG on first fetch (Calls tab). Default false. */
  requestPermissionOnMount?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = (options?.enabled ?? true) && !!user;
  const requestPermissionOnMount = options?.requestPermissionOnMount ?? false;
  const askedRef = useRef(false);

  const query = useQuery({
    queryKey: ["matched-call-logs", user?.uid],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (requestPermissionOnMount && !askedRef.current) {
        askedRef.current = true;
        await ensureCallLogPermission();
      }
      const [contacts, businesses] = await Promise.all([
        fetchContacts(user!.uid),
        fetchBusinesses(),
      ]);
      return fetchMatchedCallLogs(contacts, businesses);
    },
  });

  const refetch = query.refetch;

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refetch();
      }
    });
    return () => sub.remove();
  }, [enabled, refetch]);

  const refresh = useCallback(() => refetch(), [refetch]);

  const requestAccess = useCallback(async () => {
    askedRef.current = true;
    await ensureCallLogPermission();
    await queryClient.invalidateQueries({
      queryKey: ["matched-call-logs", user?.uid],
    });
  }, [queryClient, user?.uid]);

  return {
    ...query,
    logs: query.data?.logs ?? [],
    access: query.data?.access ?? null,
    refresh,
    requestAccess,
  };
}
