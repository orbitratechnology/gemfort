import {
  canAccessModule,
  isRegisterableRole,
  normalizeUserRole,
} from '@/constants/roles';

describe('normalizeUserRole', () => {
  it('maps legacy seller/provider roles', () => {
    expect(normalizeUserRole('seller')).toBe('trader');
    expect(normalizeUserRole('cutter')).toBe('lapidary');
  });
});

describe('role module matrix', () => {
  it('gives traders gems/trips/ap/services/cheques/bills/contacts but not jobs', () => {
    expect(canAccessModule('trader', 'gems')).toBe(true);
    expect(canAccessModule('trader', 'trips')).toBe(true);
    expect(canAccessModule('trader', 'ap')).toBe(true);
    expect(canAccessModule('trader', 'services')).toBe(true);
    expect(canAccessModule('trader', 'cheques')).toBe(true);
    expect(canAccessModule('trader', 'bills')).toBe(true);
    expect(canAccessModule('trader', 'contacts')).toBe(true);
    expect(canAccessModule('trader', 'jobs')).toBe(false);
  });

  it('gives lapidaries jobs/bills/contacts but not services, trips or AP', () => {
    expect(canAccessModule('lapidary', 'jobs')).toBe(true);
    expect(canAccessModule('lapidary', 'services')).toBe(false);
    expect(canAccessModule('lapidary', 'bills')).toBe(true);
    expect(canAccessModule('lapidary', 'contacts')).toBe(true);
    expect(canAccessModule('lapidary', 'money')).toBe(true);
    expect(canAccessModule('lapidary', 'trips')).toBe(false);
    expect(canAccessModule('lapidary', 'ap')).toBe(false);
    expect(canAccessModule('lapidary', 'gems')).toBe(false);
  });
  it('rejects admin as registerable role', () => {
    expect(isRegisterableRole('admin')).toBe(false);
    expect(isRegisterableRole('trader')).toBe(true);
  });
});
