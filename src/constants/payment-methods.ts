import type { ImageSourcePropType } from "react-native";

import type { IconName } from "@/components/ui/icon";

export type PaymentMethodOption<T extends string = string> = {
  value: T;
  label: string;
  subtitle?: string;
  icon?: IconName;
  image?: ImageSourcePropType;
  tone?: "primary" | "success" | "warning";
};

const PAYMENT_METHOD_PRESENTATION = {
  cash: {
    label: "Cash",
    subtitle: "Paid with cash",
    icon: "payments",
    tone: "success",
  },
  card: {
    label: "Card",
    subtitle: "Debit or credit card",
    icon: "credit-card",
  },
  transfer: {
    label: "Bank transfer",
    subtitle: "Paid directly to a bank account",
    icon: "account-balance",
  },
  bank_transfer: {
    label: "Bank transfer",
    subtitle: "Paid directly to a bank account",
    icon: "account-balance",
  },
  cheque: {
    label: "Cheque",
    subtitle: "Record and track a cheque",
    image: require("@/assets/images/cheque-icon.png"),
    tone: "warning",
  },
  bill: {
    label: "Bill",
    subtitle: "Record against an outstanding bill",
    image: require("@/assets/images/bill-icon.png"),
    tone: "warning",
  },
  other: {
    label: "Other",
    subtitle: "Another payment method",
    icon: "more-horiz",
  },
} satisfies Record<
  string,
  {
    label: string;
    subtitle?: string;
    icon?: IconName;
    image?: ImageSourcePropType;
    tone?: "primary" | "success" | "warning";
  }
>;

export type PaymentMethodPreset = keyof typeof PAYMENT_METHOD_PRESENTATION;

export function paymentMethodOptions<
  const T extends readonly PaymentMethodPreset[],
>(values: T): PaymentMethodOption<T[number]>[] {
  return values.map((value) => ({
    value,
    ...PAYMENT_METHOD_PRESENTATION[value],
  }));
}
