import { router } from "expo-router";
import { useState } from "react";

import { AuthHeading, AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { friendlyError } from "@/lib/errors";
import { savePhoneForVerification } from "@/lib/firebase/auth-service";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";

export default function CompletePhoneScreen() {
  const toast = useToast();
  const [phone, setPhone] = useState("");

  async function handleContinue() {
    try {
      await withLoading(async () => {
        const verifiedPhone = await savePhoneForVerification(phone);
        router.replace({
          pathname: "/(auth)/verify-otp",
          params: { phone: verifiedPhone },
        });
      }, "Saving phone number…");
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
