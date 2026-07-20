import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/firebase/phone-utils";

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
      (v) => !Number.isNaN(Number(v.replace(/,/g, ""))),
      `Enter a valid ${label.toLowerCase()}`,
    )
    .transform((v) => Number(v.replace(/,/g, "")))
    .refine((n) => n > 0, `${label} must be greater than 0`)
    .refine((n) => n <= max, `${label} is too large`);

const optionalPositiveNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v.replace(/,/g, ""))))
    .refine(
      (n) => n === undefined || (!Number.isNaN(n) && n >= 0 && n <= max),
      `Enter a valid ${label.toLowerCase()}`,
    );

export const addGemSchema = z.object({
  gemType: z.string().min(1, 'Choose a gem type'),
  originCountry: z.string().min(1, 'Choose origin'),
  roughWeight: positiveNumber('Weight', 10_000),
  acquisitionCost: positiveNumber('Purchase price'),
  treatment: z.enum([
    'natural',
    'chemical_diffusion',
    'coating',
    'diffusion',
    'doublet',
    'dyeing',
    'glass_plastic_resin_impregnation',
    'glass_plastic_resin_infilling',
    'heat_treatment',
    'oiling_waxing',
    'reconstitution',
    'smoke_diffusion',
  ]),
  colorPrimary: z.string().min(1, 'Choose a color'),
  clarity: z.string().min(1, 'Choose clarity'),
  cutType: z.string().min(1, 'Choose a cut'),
  shape: z.string().min(1, 'Choose a shape'),
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
    .min(2, "Enter destination city")
    .max(60, "City name is too long"),
  destinationCountry: z
    .string()
    .trim()
    .min(2, "Enter country")
    .max(60, "Country name is too long"),
  durationDays: z
    .string()
    .trim()
    .min(1, "Duration is required")
    .refine((v) => /^\d+$/.test(v), "Enter whole days only")
    .transform((v) => Number(v))
    .refine((n) => n >= 1 && n <= 365, "Duration must be 1-365 days"),
  budget: optionalPositiveNumber("Budget"),
  cashCarried: optionalPositiveNumber("Cash carried"),
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
  maturityDays: z
    .string()
    .trim()
    .min(1, "Maturity days required")
    .refine((v) => /^\d+$/.test(v), "Enter whole days only")
    .transform((v) => Number(v))
    .refine((n) => n >= 1 && n <= 730, "Maturity must be 1-730 days"),
  contactId: z.string().min(1, "Select a counterparty contact"),
  issuedBy: z.string().trim().max(80, "Name is too long").optional(),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type AddChequeForm = z.infer<typeof addChequeSchema>;

export const addBillSchema = z.object({
  direction: z.enum(["payable", "receivable"]),
  amount: positiveNumber("Amount"),
  dueDays: z
    .string()
    .trim()
    .min(1, "Due days required")
    .refine((v) => /^\d+$/.test(v), "Enter whole days only")
    .transform((v) => Number(v))
    .refine((n) => n >= 0 && n <= 730, "Due must be 0-730 days from today"),
  contactId: z.string().min(1, "Select who the bill is for"),
  commissionPercent: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = Number(v.replace(/,/g, ""));
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
  phone: z
    .string()
    .trim()
    .min(9, "Enter a valid phone number")
    .refine((v) => {
      const n = normalizePhoneNumber(v);
      return /^\+\d{10,15}$/.test(n);
    }, "Select your country and enter a valid mobile number"),
  password: strongPassword,
  role: z.enum(["trader", "lapidary", "gem_lab"]),
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
    .refine((v) => v.toUpperCase() === "DELETE", 'Type DELETE to confirm'),
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
    const minUtc = Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate());
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
