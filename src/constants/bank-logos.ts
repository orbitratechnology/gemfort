import type { ImageSource } from "expo-image";

import type { SriLankaBank } from "@/constants/sri-lanka-banks";

/**
 * Bundled bank logos keyed by CEFTS bank code: square, trimmed, transparent
 * WebP (≤512px) taken from each bank's own site or Wikimedia Commons. Banks
 * without one fall back to initials in the UI.
 */
const BANK_LOGOS: Record<string, ImageSource> = {
  "7010": require("@/assets/images/banks/7010.webp"), // Bank of Ceylon
  "7038": require("@/assets/images/banks/7038.webp"), // Standard Chartered Bank
  "7047": require("@/assets/images/banks/7047.webp"), // Citi Bank
  "7056": require("@/assets/images/banks/7056.webp"), // Commercial Bank PLC
  "7074": require("@/assets/images/banks/7074.webp"), // Habib Bank Ltd
  "7083": require("@/assets/images/banks/7083.webp"), // Hatton National Bank PLC
  "7092": require("@/assets/images/banks/7092.webp"), // Hongkong Shanghai Bank
  "7117": require("@/assets/images/banks/7117.webp"), // Indian Overseas Bank
  "7135": require("@/assets/images/banks/7135.webp"), // Peoples Bank
  "7144": require("@/assets/images/banks/7144.webp"), // State Bank of India
  "7162": require("@/assets/images/banks/7162.webp"), // Nations Trust Bank PLC
  "7205": require("@/assets/images/banks/7205.webp"), // Deutsche Bank
  "7214": require("@/assets/images/banks/7214.webp"), // National Development Bank PLC
  "7269": require("@/assets/images/banks/7269.webp"), // MCB Bank Ltd
  "7278": require("@/assets/images/banks/7278.webp"), // Sampath Bank PLC
  "7287": require("@/assets/images/banks/7287.webp"), // Seylan Bank PLC
  "7296": require("@/assets/images/banks/7296.webp"), // Public Bank
  "7302": require("@/assets/images/banks/7302.webp"), // Union Bank of Colombo PLC
  "7311": require("@/assets/images/banks/7311.webp"), // Pan Asia Banking Corporation PLC
  "7384": require("@/assets/images/banks/7384.webp"), // ICICI Bank Ltd
  "7454": require("@/assets/images/banks/7454.webp"), // DFCC Bank PLC
  "7463": require("@/assets/images/banks/7463.webp"), // Amana Bank PLC
  "7472": require("@/assets/images/banks/7472.webp"), // Axis Bank
  "7481": require("@/assets/images/banks/7481.webp"), // Cargills Bank Limited
  "7719": require("@/assets/images/banks/7719.webp"), // National Savings Bank
  "7728": require("@/assets/images/banks/7728.webp"), // Sanasa Development Bank
  "7737": require("@/assets/images/banks/7737.webp"), // HDFC Bank
  "7746": require("@/assets/images/banks/7746.webp"), // Citizen Development Business Finance PLC
  "7755": require("@/assets/images/banks/7755.webp"), // Regional Development Bank
  "7764": require("@/assets/images/banks/7764.webp"), // State Mortgage & Investment Bank
  "7773": require("@/assets/images/banks/7773.webp"), // LB Finance PLC
  "7807": require("@/assets/images/banks/7807.webp"), // Commercial Leasing and Finance
  "7816": require("@/assets/images/banks/7816.webp"), // Vallibel Finance PLC
  "7825": require("@/assets/images/banks/7825.webp"), // Central Finance PLC
  "7834": require("@/assets/images/banks/7834.webp"), // Kanrich Finance Limited
  "7852": require("@/assets/images/banks/7852.webp"), // Alliance Finance Company PLC
  "7861": require("@/assets/images/banks/7861.webp"), // LOLC Finance PLC
  "7898": require("@/assets/images/banks/7898.webp"), // Merchant Bank of Sri Lanka & Finance PLC
  "7904": require("@/assets/images/banks/7904.webp"), // HNB Grameen Finance Limited
  "7913": require("@/assets/images/banks/7913.webp"), // Mercantile Investment and Finance PLC
  "7922": require("@/assets/images/banks/7922.webp"), // People
  "8004": require("@/assets/images/banks/8004.webp"), // Central Bank of Sri Lanka
};

export function bankLogo(bank: SriLankaBank): ImageSource | null {
  return BANK_LOGOS[bank.code] ?? null;
}
