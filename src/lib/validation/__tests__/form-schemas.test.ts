import {
  addGemSchema,
  loginSchema,
  parseForm,
  registerSchema,
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
  it('parses numeric strings', () => {
    const r = parseForm(addGemSchema, {
      gemType: 'sapphire',
      originCountry: 'Sri Lanka',
      roughWeight: '3.2',
      acquisitionCost: '150,000',
      treatment: 'none',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.roughWeight).toBe(3.2);
      expect(r.data.acquisitionCost).toBe(150000);
    }
  });

  it('rejects zero weight', () => {
    const r = parseForm(addGemSchema, {
      gemType: 'sapphire',
      originCountry: 'Sri Lanka',
      roughWeight: '0',
      acquisitionCost: '100',
      treatment: 'none',
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
