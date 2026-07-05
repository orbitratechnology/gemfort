export const CONTACT_TYPES = ['broker', 'cutter', 'buyer', 'supplier', 'other'] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
