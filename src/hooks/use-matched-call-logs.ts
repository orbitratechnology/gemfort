import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  ensureCallLogPermission,
  fetchMatchedCallLogs,
  isCallLogsSupported,
} from "@/features/workspace/call-logs-service";
import { fetchContacts } from "@/features/workspace/workspace-service";
import { useAuth } from "@/providers/auth-provider";

/**
 * Auto-syncs Android call logs with workspace contacts + verified businesses.
 * No-op on iOS (Apple does not allow call-log access).
 */
export function useMatchedCallLogs(options?: {
  enabled?: boolean;
  /** Prompt for READ_CALL_LOG on first fetch (Calls tab). Default false. */
  requestPermissionOnMount?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supported = isCallLogsSupported();
  const enabled = (options?.enabled ?? true) && !!user && supported;
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

  const refresh = useCallback(() => {
    if (!supported) return Promise.resolve();
    return refetch();
  }, [refetch, supported]);

  const requestAccess = useCallback(async () => {
    if (!supported) return;
    askedRef.current = true;
    await ensureCallLogPermission();
    await queryClient.invalidateQueries({
      queryKey: ["matched-call-logs", user?.uid],
    });
  }, [queryClient, supported, user?.uid]);

  return {
    ...query,
    logs: query.data?.logs ?? [],
    access: query.data?.access ?? (supported ? null : { status: "unsupported" as const }),
    supported,
    refresh,
    requestAccess,
  };
}
