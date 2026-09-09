import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";

import { AuthHeading, AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { friendlyError } from "@/lib/errors";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { sendPhoneVerificationCode } from "@/lib/firebase/phone-auth";
import { normalizePhoneNumber } from "@/lib/firebase/phone-utils";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";

export default function CompletePhoneScreen() {
  const toast = useToast();
  const { phone: phoneParam, afterRegistration } = useLocalSearchParams<{
    phone?: string | string[];
    afterRegistration?: string | string[];
  }>();
  const initialPhone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
  const [phone, setPhone] = useState(initialPhone ?? "");
  const sendingRef = useRef(false);

  async function handleContinue() {
    if (sendingRef.current) return;

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
      toast.error("Select your country and enter a valid mobile number.");
      return;
    }
    const params: { phone: string; afterRegistration?: string } = {
      phone: normalizedPhone,
    };
    const registrationFlow = Array.isArray(afterRegistration)
      ? afterRegistration[0]
      : afterRegistration;
    if (registrationFlow === "1") params.afterRegistration = "1";
    if (!isFirebaseConfigured) {
      toast.error("Firebase not configured. Set EXPO_PUBLIC_FIREBASE_* env vars.");
      return;
    }

    sendingRef.current = true;
    try {
      const verificationId = await withLoading(
        () => sendPhoneVerificationCode(normalizedPhone),
        { message: "Sending code…", overlay: false },
      );
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: { ...params, verificationId },
      });
    } catch (error) {
      sendingRef.current = false;
      toast.error(
        friendlyError(error, "Could not send the verification code. Try again."),
      );
    }
  }

  return (
    <AuthScreen safeTop>
      <AuthHeading
        title="Add your mobile number"
        subtitle="We use it to protect your GemFort account."
      />
      <PhoneNumberField
        label="Mobile number"
        appearance="pill"
        value={phone}
        onChangeText={setPhone}
        placeholder="Mobile number"
      />
      <Button title="Continue" icon="arrow-forward" onPress={handleContinue} />
    </AuthScreen>
  );
}
