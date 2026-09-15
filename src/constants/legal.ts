export const TERMS_URL =
  "https://www.orbitratech.net/gemfort/terms-and-conditions";
export const PRIVACY_URL =
  "https://www.orbitratech.net/gemfort/privacy-policy";

/** Version recorded with each new account's legal acceptance. */
export const LEGAL_POLICY_VERSION = "2026-09-16";

export const CURRENT_LEGAL_ACCEPTANCE = {
  termsVersion: LEGAL_POLICY_VERSION,
  privacyVersion: LEGAL_POLICY_VERSION,
} as const;

export type LegalAcceptance = {
  termsVersion: string;
  privacyVersion: string;
};
