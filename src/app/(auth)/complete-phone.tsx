import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { AuthHeading, AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { friendlyError } from "@/lib/errors";
import { normalizePhoneNumber } from "@/lib/firebase/phone-utils";
import { useToast } from "@/providers/toast-provider";

export default function CompletePhoneScreen() {
  const toast = useToast();
  const { afterRegistration } = useLocalSearchParams<{
    afterRegistration?: string | string[];
  }>();
  const [phone, setPhone] = useState("");

  function handleContinue() {
    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
        throw new Error("Select your country and enter a valid mobile number.");
      }
      const params: { phone: string; afterRegistration?: string } = {
        phone: normalizedPhone,
      };
      const registrationFlow = Array.isArray(afterRegistration)
        ? afterRegistration[0]
        : afterRegistration;
      if (registrationFlow === "1") params.afterRegistration = "1";
      router.replace({
        pathname: "/(auth)/verify-otp",
        params,
      });
    } catch (error) {
      toast.error(
        friendlyError(error, "Enter a valid mobile number to continue."),
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
