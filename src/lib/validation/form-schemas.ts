import { z } from "zod";

import { parseAmountInput } from "@/lib/money/mask";

/** Map Zod flatten errors into a field → message record for inline UI. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const flat = error.flatten().fieldErrors;
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages?.[0]) out[key] = messages[0];
  }
  return out;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
):
  | { success: true; data: z.infer<T> }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: fieldErrorsFromZod(result.error) };
}

const positiveNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => !Number.isNaN(parseAmountInput(v)),
      `Enter a valid ${label.toLowerCase()}`,
    )
    .transform((v) => parseAmountInput(v))
    .refine((n) => n > 0, `${label} must be greater than 0`)
    .refine((n) => n <= max, `${label} is too large`);

const optionalPositiveNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .transform((v) => {
      if (v === "") return undefined;
      const n = parseAmountInput(v);
      return Number.isNaN(n) ? Number.NaN : n;
    })
    .refine(
      (n) => n === undefined || (!Number.isNaN(n) && n >= 0 && n <= max),
      `Enter a valid ${label.toLowerCase()}`,
    );

const wholeDays = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^\d+$/.test(v), "Enter whole days only")
    .transform((v) => Number(v))
    .refine((n) => n >= min && n <= max, `${label} must be ${min}-${max} days`);

const gemTreatmentEnum = z.enum([
  "natural",
  "chemical_diffusion",
  "coating",
  "diffusion",
  "doublet",
  "dyeing",
  "glass_plastic_resin_impregnation",
  "glass_plastic_resin_infilling",
  "heat_treatment",
  "oiling_waxing",
  "reconstitution",
  "smoke_diffusion",
]);

const gemStatusEnum = z.enum([
  "rough",
  "with_cutter",
  "cut",
  "with_heater",
  "heated",
  "with_polisher",
  "polished",
  "ready_for_sale",
  "on_ap",
  "on_trip",
  "listed",
  "sold",
  "returned",
]);

/** Empty string → undefined so optional picker fields stay optional. */
const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v));

export const addGemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title")
    .max(80, "Title must be 80 characters or less"),
  gemType: z.string().min(1, "Choose a gem type"),
  roughWeight: positiveNumber("Weight", 10_000),
  acquisitionCost: positiveNumber("Purchase price"),
  originCountry: optionalTrimmed,
  colorPrimary: optionalTrimmed,
  clarity: optionalTrimmed,
  shape: optionalTrimmed,
  treatment: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(gemTreatmentEnum.optional()),
  status: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(gemStatusEnum.optional()),
});

export type AddGemForm = z.infer<typeof addGemSchema>;

export const addTripSchema = z.object({
  tripName: z
    .string()
    .trim()
    .min(3, "Trip name needs at least 3 characters")
    .max(80, "Trip name is too long"),
  tripType: z.enum(["sourcing", "selling", "both"]),
  destinationCity: z
    .string()
    .trim()
    .min(2, "Select destination city")
    .max(60, "City name is too long"),
  destinationCountry: z
    .string()
    .trim()
    .min(2, "Select country")
    .max(60, "Country name is too long"),
  durationDays: wholeDays("Duration", 1, 365),
  budget: optionalPositiveNumber("Budget"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type AddTripForm = z.infer<typeof addTripSchema>;

export const addChequeSchema = z.object({
  direction: z.enum(["received", "given"]),
  chequeNumber: z
    .string()
    .trim()
    .min(3, "Cheque number needs at least 3 characters")
    .max(32, "Cheque number is too long"),
  bankName: z
    .string()
    .trim()
    .min(2, "Enter bank name")
    .max(80, "Bank name is too long"),
  branch: z.string().trim().max(80, "Branch is too long").optional(),
  amount: positiveNumber("Amount"),
  maturityDays: wholeDays("Maturity", 1, 730),
  contactId: z.string().min(1, "Select a counterparty contact"),
  issuedBy: z.string().trim().max(80, "Name is too long").optional(),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type AddChequeForm = z.infer<typeof addChequeSchema>;

export const addBillSchema = z.object({
  direction: z.enum(["payable", "receivable"]),
  amount: positiveNumber("Amount"),
  dueDays: wholeDays("Due", 0, 730),
  contactId: z.string().min(1, "Select who the bill is for"),
  commissionPercent: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = parseAmountInput(v);
      return Number.isNaN(n) ? Number.NaN : n;
    })
    .refine(
      (n) => n === null || (!Number.isNaN(n) && n >= 0 && n <= 100),
      "Commission must be 0-100%",
    ),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type AddBillForm = z.infer<typeof addBillSchema>;

export const recordSaleSchema = z.object({
  gemId: z.string().min(1, "Choose which stone you are selling"),
  price: positiveNumber("Sale price"),
  buyer: z.string().trim().max(80, "Buyer name is too long").optional(),
  method: z.enum(["transfer", "cash", "cheque"]),
});

export type RecordSaleForm = z.infer<typeof recordSaleSchema>;

export const addApSchema = z.object({
  holderId: z.string().min(1, "Select an AP holder"),
  days: wholeDays("Expected days", 1, 365),
  gemCount: z.number().min(1, "Add at least one gem"),
});

export type AddApForm = z.infer<typeof addApSchema>;

/** Validate a single currency/weight face-amount string; returns error message or null. */
export function amountFieldError(
  label: string,
  value: string,
  opts?: { required?: boolean; max?: number },
): string | null {
  const required = opts?.required !== false;
  const max = opts?.max ?? 99_999_999;
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required` : null;
  const n = parseAmountInput(trimmed);
  if (Number.isNaN(n)) return `Enter a valid ${label.toLowerCase()}`;
  if (n <= 0 && required) return `${label} must be greater than 0`;
  if (n < 0) return `Enter a valid ${label.toLowerCase()}`;
  if (n > max) return `${label} is too large`;
  return null;
}

export const addServiceSchema = z.object({
  gemId: z.string().min(1, "Select a gem"),
  hasProvider: z.literal(true, {
    errorMap: () => ({ message: "Select a provider" }),
  }),
  weightBefore: positiveNumber("Weight", 10_000),
  daysUntilReturn: wholeDays("Return days", 1, 365),
  serviceType: z.enum([
    "cutting",
    "heating",
    "polishing",
    "recutting",
    "appraisal",
  ]),
});

export type AddServiceForm = z.infer<typeof addServiceSchema>;

export const addTripPurchaseSchema = z.object({
  gemType: z.string().min(1, "Choose a gem type"),
  originCountry: z
    .string()
    .trim()
    .min(2, "Select origin country")
    .max(60, "Country name is too long"),
  roughWeight: positiveNumber("Weight", 10_000),
  acquisitionCost: positiveNumber("Purchase price"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type AddTripPurchaseForm = z.infer<typeof addTripPurchaseSchema>;

export const addTripExpenseSchema = z.object({
  category: z.string().min(1, "Choose a category"),
  amount: positiveNumber("Amount"),
  description: z.string().trim().max(200, "Description is too long").optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]),
});

export type AddTripExpenseForm = z.infer<typeof addTripExpenseSchema>;

export const addTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: positiveNumber("Amount"),
  description: z.string().trim().max(200, "Description is too long").optional(),
});

export type AddTransactionForm = z.infer<typeof addTransactionSchema>;

export const addPayableSchema = z.object({
  contactId: optionalTrimmed,
  title: z
    .string()
    .trim()
    .min(1, "Enter a title/reason")
    .max(120, "Title is too long"),
  amount: positiveNumber("Amount"),
});

export type AddPayableForm = z.infer<typeof addPayableSchema>;

export const addReceivableSchema = z.object({
  contactId: optionalTrimmed,
  title: z
    .string()
    .trim()
    .min(1, "Enter a title/reason")
    .max(120, "Title is too long"),
  amount: positiveNumber("Amount"),
  commission: optionalPositiveNumber("Commission"),
});

export type AddReceivableForm = z.infer<typeof addReceivableSchema>;

export const recordPaymentSchema = z.object({
  amount: positiveNumber("Payment amount"),
});

export type RecordPaymentForm = z.infer<typeof recordPaymentSchema>;

export const completeServiceSchema = z.object({
  weightAfter: positiveNumber("Weight after", 10_000),
  finalCost: positiveNumber("Final cost"),
});

export type CompleteServiceForm = z.infer<typeof completeServiceSchema>;

const nonNegativeNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => !Number.isNaN(parseAmountInput(v)),
      `Enter a valid ${label.toLowerCase()}`,
    )
    .transform((v) => parseAmountInput(v))
    .refine((n) => n >= 0, `${label} cannot be negative`)
    .refine((n) => n <= max, `${label} is too large`);

/** AP sale: sender payout + receiver keep (soldPrice = sum). */
export const sellApGemSchema = z.object({
  ownerReceives: positiveNumber("Sender amount"),
  receiverKeeps: nonNegativeNumber("Your amount"),
  soldToName: z.string().trim().max(80, "Name is too long").optional(),
  paymentDueDays: wholeDays("Payment due", 0, 730),
});

export type SellApGemForm = z.infer<typeof sellApGemSchema>;

export const listingOfferSchema = z.object({
  amount: positiveNumber("Offer amount"),
  message: z.string().trim().max(500, "Message is too long").optional(),
});

export type ListingOfferForm = z.infer<typeof listingOfferSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginForm = z.infer<typeof loginSchema>;

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .refine(
    (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
    "Include letters and a number",
  );

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(60, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: strongPassword,
  role: z.enum(["trader", "lapidary"]),
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a different password",
    path: ["newPassword"],
  });

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
  confirmText: z
    .string()
    .trim()
    .refine((v) => v.toUpperCase() === "DELETE", "Type DELETE to confirm"),
});

export type DeleteAccountForm = z.infer<typeof deleteAccountSchema>;

/** Birthdate as ISO `YYYY-MM-DD` for verification. */
export const verificationDateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your date of birth")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const dob = new Date(Date.UTC(y, m - 1, d));
    if (
      Number.isNaN(dob.getTime()) ||
      dob.getUTCFullYear() !== y ||
      dob.getUTCMonth() !== m - 1 ||
      dob.getUTCDate() !== d
    ) {
      return false;
    }
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const minUtc = Date.UTC(
      today.getUTCFullYear() - 120,
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    return dob.getTime() <= todayUtc && dob.getTime() >= minUtc;
  }, "Enter a valid date of birth");

export const verificationApplicantSchema = z.object({
  dateOfBirth: verificationDateOfBirthSchema,
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business or company name")
    .max(80, "Name is too long"),
});

export type VerificationApplicantForm = z.infer<
  typeof verificationApplicantSchema
>;

export const verifyOtpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit SMS code"),
});

export type VerifyOtpForm = z.infer<typeof verifyOtpSchema>;
