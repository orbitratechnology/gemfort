import {
  canAccessModule,
  isRegisterableRole,
  modulesForRole,
  normalizeUserRole,
} from '@/constants/roles';

describe('normalizeUserRole', () => {
  it('maps legacy seller/provider roles', () => {
    expect(normalizeUserRole('seller')).toBe('trader');
    expect(normalizeUserRole('cutter')).toBe('lapidary');
    expect(normalizeUserRole('lab')).toBe('gem_lab');
  });
});

describe('role module matrix', () => {
  it('gives traders gems/trips/ap but not jobs/certificates', () => {
    expect(canAccessModule('trader', 'gems')).toBe(true);
    expect(canAccessModule('trader', 'trips')).toBe(true);
    expect(canAccessModule('trader', 'jobs')).toBe(false);
    expect(canAccessModule('trader', 'certificates')).toBe(false);
  });

  it('gives lapidaries jobs/services but not trips', () => {
    expect(canAccessModule('lapidary', 'jobs')).toBe(true);
    expect(canAccessModule('lapidary', 'services')).toBe(true);
    expect(canAccessModule('lapidary', 'trips')).toBe(false);
  });

  it('gives gem labs certificates and money only', () => {
    expect(modulesForRole('gem_lab')).toEqual(['certificates', 'money']);
  });

  it('rejects admin as registerable role', () => {
    expect(isRegisterableRole('admin')).toBe(false);
    expect(isRegisterableRole('trader')).toBe(true);
  });
});
