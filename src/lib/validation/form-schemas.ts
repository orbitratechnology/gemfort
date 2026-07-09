import { z } from 'zod';

import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';

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
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: fieldErrorsFromZod(result.error) };
}

const positiveNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v.replace(/,/g, ''))), `Enter a valid ${label.toLowerCase()}`)
    .transform((v) => Number(v.replace(/,/g, '')))
    .refine((n) => n > 0, `${label} must be greater than 0`)
    .refine((n) => n <= max, `${label} is too large`);

const optionalPositiveNumber = (label: string, max = 99_999_999) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : Number(v.replace(/,/g, ''))))
    .refine(
      (n) => n === undefined || (!Number.isNaN(n) && n >= 0 && n <= max),
      `Enter a valid ${label.toLowerCase()}`,
    );

export const addGemSchema = z.object({
  gemType: z.string().min(1, 'Choose a gem type'),
  originCountry: z
    .string()
    .trim()
    .min(2, 'Enter origin (e.g. Sri Lanka)')
    .max(60, 'Origin is too long'),
  roughWeight: positiveNumber('Weight', 10_000),
  acquisitionCost: positiveNumber('Purchase price'),
  treatment: z.enum(['none', 'heat', 'oil', 'irradiation']),
});

export type AddGemForm = z.infer<typeof addGemSchema>;

export const addTripSchema = z.object({
  tripName: z
    .string()
    .trim()
    .min(3, 'Trip name needs at least 3 characters')
    .max(80, 'Trip name is too long'),
  tripType: z.enum(['sourcing', 'selling', 'both']),
  destinationCity: z
    .string()
    .trim()
    .min(2, 'Enter destination city')
    .max(60, 'City name is too long'),
  destinationCountry: z
    .string()
    .trim()
    .min(2, 'Enter country')
    .max(60, 'Country name is too long'),
  durationDays: z
    .string()
    .trim()
    .min(1, 'Duration is required')
    .refine((v) => /^\d+$/.test(v), 'Enter whole days only')
    .transform((v) => Number(v))
    .refine((n) => n >= 1 && n <= 365, 'Duration must be 1-365 days'),
  budget: optionalPositiveNumber('Budget'),
  cashCarried: optionalPositiveNumber('Cash carried'),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
});

export type AddTripForm = z.infer<typeof addTripSchema>;

export const addChequeSchema = z.object({
  direction: z.enum(['received', 'given']),
  chequeNumber: z
    .string()
    .trim()
    .min(3, 'Cheque number needs at least 3 characters')
    .max(32, 'Cheque number is too long'),
  bankName: z
    .string()
    .trim()
    .min(2, 'Enter bank name')
    .max(80, 'Bank name is too long'),
  branch: z.string().trim().max(80, 'Branch is too long').optional(),
  amount: positiveNumber('Amount'),
  maturityDays: z
    .string()
    .trim()
    .min(1, 'Maturity days required')
    .refine((v) => /^\d+$/.test(v), 'Enter whole days only')
    .transform((v) => Number(v))
    .refine((n) => n >= 1 && n <= 730, 'Maturity must be 1-730 days'),
  contactId: z.string().min(1, 'Select a counterparty contact'),
  issuedBy: z.string().trim().max(80, 'Name is too long').optional(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
});

export type AddChequeForm = z.infer<typeof addChequeSchema>;

export const recordSaleSchema = z.object({
  gemId: z.string().min(1, 'Choose which stone you are selling'),
  price: positiveNumber('Sale price'),
  buyer: z.string().trim().max(80, 'Buyer name is too long').optional(),
  method: z.enum(['transfer', 'cash', 'cheque']),
});

export type RecordSaleForm = z.infer<typeof recordSaleSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(60, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(9, 'Enter a valid phone number')
    .refine((v) => {
      const n = normalizePhoneNumber(v);
      return /^\+\d{10,15}$/.test(n);
    }, 'Use a valid mobile (e.g. +94 77X XXX XXXX)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long')
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include letters and a number'),
  roleIntent: z.enum(['normal_user', 'verified_seller', 'verified_provider']),
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const verifyOtpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit SMS code'),
});

export type VerifyOtpForm = z.infer<typeof verifyOtpSchema>;
