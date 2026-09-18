import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Icon } from "@/components/ui/icon";
import {
  isScannerCancellation,
  scanCertificateBarcode,
} from "@/features/verification/certificate-scanner";
import { openVerificationUrl } from "@/features/verification/verification-links";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useToast } from "@/providers/toast-provider";

export default function ScanCertificateScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const toastRef = useRef(toast);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;
    void scanCertificateBarcode()
      .then((result) => {
        if (!active) return;

        router.back();
        if (result.kind === "opened") {
          void openVerificationUrl(result.url).catch(() => {
            toastRef.current.error("Could not open the verification report.");
          });
          return;
        }

        toastRef.current.error(
          "This code does not contain a verification link. Choose a portal to verify it.",
        );
      })
      .catch((error: unknown) => {
        if (!active) return;

        router.back();
        if (!isScannerCancellation(error)) {
          toastRef.current.error(
            "Could not start the certificate scanner. Please try again.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={[]}
    >
      <View style={styles.content}>
        <Icon name="qr-code-scanner" size={30} color={colors.primary} />
        <Text style={[styles.title, { color: colors.onSurface }]}>
          Opening scanner…
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "600" },
});
