import {
  addGemSchema,
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  parseForm,
  registerSchema,
  verificationApplicantSchema,
  verifyOtpSchema,
} from '@/lib/validation/form-schemas';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const r = parseForm(loginSchema, { email: 'qa-trader@gemfort.test', password: 'QaTest123!' });
    expect(r.success).toBe(true);
  });

  it('rejects bad email and short password', () => {
    const r = parseForm(loginSchema, { email: 'nope', password: '123' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.password).toBeTruthy();
    }
  });
});

describe('registerSchema', () => {
  const valid = {
    displayName: 'QA Trader',
    email: 'new@gemfort.test',
    phone: '0771234567',
    password: 'SecurePass1',
    role: 'trader' as const,
  };

  it('accepts trader registration', () => {
    const r = parseForm(registerSchema, valid);
    expect(r.success).toBe(true);
  });

  it('rejects password without a digit', () => {
    const r = parseForm(registerSchema, { ...valid, password: 'OnlyLetters' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const r = parseForm(registerSchema, { ...valid, role: 'admin' });
    expect(r.success).toBe(false);
  });
});

describe('addGemSchema', () => {
  it('parses required fields only', () => {
    const r = parseForm(addGemSchema, {
      title: 'Lot A blue',
      gemType: 'sapphire',
      roughWeight: '3.2',
      acquisitionCost: '150,000',
      originCountry: '',
      colorPrimary: '',
      clarity: '',
      shape: '',
      treatment: '',
      status: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.roughWeight).toBe(3.2);
      expect(r.data.acquisitionCost).toBe(150000);
      expect(r.data.title).toBe('Lot A blue');
      expect(r.data.originCountry).toBeUndefined();
      expect(r.data.treatment).toBeUndefined();
      expect(r.data.status).toBeUndefined();
    }
  });

  it('parses optional attribute fields when provided', () => {
    const r = parseForm(addGemSchema, {
      title: 'Lot A blue',
      gemType: 'sapphire',
      roughWeight: '3.2',
      acquisitionCost: '150,000',
      originCountry: 'Sri Lanka',
      treatment: 'natural',
      colorPrimary: 'royal_blue',
      clarity: 'eye_clean',
      shape: 'oval',
      status: 'rough',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.originCountry).toBe('Sri Lanka');
      expect(r.data.shape).toBe('oval');
      expect(r.data.status).toBe('rough');
    }
  });

  it('rejects zero weight', () => {
    const r = parseForm(addGemSchema, {
      title: 'Lot A blue',
      gemType: 'sapphire',
      roughWeight: '0',
      acquisitionCost: '100',
      originCountry: '',
      colorPrimary: '',
      clarity: '',
      shape: '',
      treatment: '',
      status: '',
    });
    expect(r.success).toBe(false);
  });
});

describe('verifyOtpSchema', () => {
  it('requires exactly 6 digits', () => {
    expect(parseForm(verifyOtpSchema, { code: '123456' }).success).toBe(true);
    expect(parseForm(verifyOtpSchema, { code: '12a456' }).success).toBe(false);
    expect(parseForm(verifyOtpSchema, { code: '12345' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts a valid password change', () => {
    const r = parseForm(changePasswordSchema, {
      currentPassword: 'OldPass12',
      newPassword: 'NewPass34',
      confirmPassword: 'NewPass34',
    });
    expect(r.success).toBe(true);
  });

  it('rejects mismatched confirmation', () => {
    const r = parseForm(changePasswordSchema, {
      currentPassword: 'OldPass12',
      newPassword: 'NewPass34',
      confirmPassword: 'NewPass99',
    });
    expect(r.success).toBe(false);
  });
});

describe('deleteAccountSchema', () => {
  it('requires DELETE confirmation', () => {
    expect(
      parseForm(deleteAccountSchema, { password: 'Pass1234', confirmText: 'DELETE' }).success,
    ).toBe(true);
    expect(
      parseForm(deleteAccountSchema, { password: 'Pass1234', confirmText: 'delete' }).success,
    ).toBe(true);
    expect(
      parseForm(deleteAccountSchema, { password: 'Pass1234', confirmText: 'remove' }).success,
    ).toBe(false);
  });
});

describe('verificationApplicantSchema', () => {
  it('requires birthdate and business name', () => {
    const r = parseForm(verificationApplicantSchema, {
      dateOfBirth: '1990-05-12',
      businessName: 'Ceylon Gems Co',
    });
    expect(r.success).toBe(true);
  });

  it('rejects future birthdates and empty company', () => {
    const future = parseForm(verificationApplicantSchema, {
      dateOfBirth: '2099-01-01',
      businessName: 'Ceylon Gems Co',
    });
    expect(future.success).toBe(false);

    const noName = parseForm(verificationApplicantSchema, {
      dateOfBirth: '1990-05-12',
      businessName: 'A',
    });
    expect(noName.success).toBe(false);
  });
});
