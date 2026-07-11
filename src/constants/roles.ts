import type { UserProfile, UserRole } from '@/types';

export const REGISTERABLE_ROLES: UserRole[] = ['trader', 'lapidary', 'gem_lab'];

export const ROLE_LABELS: Record<UserRole, string> = {
  trader: 'Trader',
  lapidary: 'Lapidary',
  gem_lab: 'Gem Lab',
  admin: 'Administrator',
};

export const ROLE_SUBTITLES: Record<Exclude<UserRole, 'admin'>, string> = {
  trader: 'Buy and sell gemstones',
  lapidary: 'Cutting, heating, polishing & more',
  gem_lab: 'Issue and verify gem certificates',
};

export const LAPIDARY_SERVICE_OPTIONS = [
  { id: 'cutting', label: 'Cutting' },
  { id: 'polishing', label: 'Polishing' },
  { id: 'shaping', label: 'Shaping' },
  { id: 'heating', label: 'Heat treatment' },
  { id: 'chemical_treatment', label: 'Chemical treatment' },
  { id: 'other', label: 'Other' },
] as const;

export type LapidaryServiceId = (typeof LAPIDARY_SERVICE_OPTIONS)[number]['id'];

export type WorkspaceModule =
  | 'gems'
  | 'trips'
  | 'ap'
  | 'services'
  | 'jobs'
  | 'certificates'
  | 'money'
  | 'cheques'
  | 'requests';

const MODULES_BY_ROLE: Record<Exclude<UserRole, 'admin'>, WorkspaceModule[]> = {
  trader: ['gems', 'trips', 'ap', 'money', 'cheques', 'requests'],
  lapidary: ['services', 'jobs', 'money'],
  gem_lab: ['certificates', 'money'],
};

export function isRegisterableRole(role: string | null | undefined): role is UserRole {
  return role === 'trader' || role === 'lapidary' || role === 'gem_lab';
}

/** Normalize legacy Firestore roles to the new model. */
export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (role === 'verified_seller' || role === 'seller' || role === 'normal_user') return 'trader';
  if (role === 'verified_provider' || role === 'provider' || role === 'cutter') return 'lapidary';
  if (role === 'lab' || role === 'gem_lab') return 'gem_lab';
  if (role === 'admin') return 'admin';
  if (role === 'trader' || role === 'lapidary') return role;
  return 'trader';
}

export function resolveProfileRole(profile: UserProfile | null): UserRole {
  if (!profile) return 'trader';
  if (profile.role === 'admin') return 'admin';
  return normalizeUserRole(profile.role || profile.roleIntent);
}

export function isVerifiedRole(profile: UserProfile | null, role?: UserRole): boolean {
  if (!profile || profile.verificationStatus !== 'verified') return false;
  const effective = resolveProfileRole(profile);
  if (!role) return effective === 'trader' || effective === 'lapidary' || effective === 'gem_lab';
  return effective === role;
}

export function canAccessModule(role: UserRole, module: WorkspaceModule): boolean {
  if (role === 'admin') return true;
  return MODULES_BY_ROLE[role]?.includes(module) ?? false;
}

export function modulesForRole(role: UserRole): WorkspaceModule[] {
  if (role === 'admin') {
    return ['gems', 'trips', 'ap', 'services', 'jobs', 'certificates', 'money', 'cheques', 'requests'];
  }
  return MODULES_BY_ROLE[role] ?? [];
}

export function businessTypeFromRole(role: UserRole): 'trader' | 'lapidary' | 'gem_lab' | null {
  if (role === 'trader') return 'trader';
  if (role === 'lapidary') return 'lapidary';
  if (role === 'gem_lab') return 'gem_lab';
  return null;
}

export function directoryTabFromBusinessType(
  businessType: string | null | undefined,
): 'traders' | 'lapidaries' | 'labs' {
  if (businessType === 'gem_lab' || businessType === 'lab') return 'labs';
  if (
    businessType === 'lapidary' ||
    businessType === 'cutter' ||
    businessType === 'heat_treatment' ||
    businessType === 'chemical_treatment' ||
    businessType === 'polisher' ||
    businessType === 'jewelry_maker' ||
    businessType === 'provider'
  ) {
    return 'lapidaries';
  }
  return 'traders';
}
