import { router, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

import { friendlyError } from "@/lib/errors";
import { logoutUser } from "@/lib/firebase/auth-service";
import { useConfirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";

const LOGIN_HREF = "/(auth)/login" as const;

const DEFAULT_MESSAGE =
  "Your account stays saved so you can finish phone verification later. Signing out only ends this session.";

type RegistrationExitOptions = {
  title?: string;
  message?: string;
};

/**
 * Protects an incomplete auth step from accidental navigation and provides
 * an explicit, authenticated sign-out action.
 */
export function useRegistrationExit({
  title = "Leave registration?",
  message = DEFAULT_MESSAGE,
}: RegistrationExitOptions = {}) {
  const { confirm, showActions } = useConfirm();
  const toast = useToast();
  const navigation = useNavigation();
  const allowNextRemovalRef = useRef(false);
  const leavingRef = useRef(false);

  const allowNextNavigation = useCallback(() => {
    allowNextRemovalRef.current = true;
  }, []);

  const signOutAndNavigate = useCallback(
    async () => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      try {
        await withLoading(
          () => logoutUser(),
          { message: "Signing out…", overlay: false },
        );
        allowNextRemovalRef.current = true;
        router.replace(LOGIN_HREF);
      } catch (error) {
        allowNextRemovalRef.current = false;
        leavingRef.current = false;
        toast.error(friendlyError(error, "Could not sign out. Try again."));
      }
    },
    [toast],
  );

  const confirmSignOut = useCallback(
    () => {
      void confirm({
        title,
        message,
        confirmLabel: "Sign out",
        cancelLabel: "Continue",
        tone: "destructive",
        icon: "logout",
        onConfirm: () => signOutAndNavigate(),
      });
    },
    [confirm, message, signOutAndNavigate, title],
  );

  const showExitOptions = useCallback(() => {
    if (leavingRef.current) return;
    showActions({
      title,
      message,
      cancelLabel: "Continue",
      actions: [
        {
          label: "Sign out",
          onPress: confirmSignOut,
        },
      ],
    });
  }, [confirmSignOut, message, showActions, title]);

  const handleBack = useCallback(() => {
    showExitOptions();
  }, [showExitOptions]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowNextRemovalRef.current) {
        allowNextRemovalRef.current = false;
        return;
      }

      event.preventDefault();
      handleBack();
    });

    return unsubscribe;
  }, [handleBack, navigation]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleBack]);

  return {
    allowNextNavigation,
    confirmSignOut,
    showExitOptions,
  };
}
