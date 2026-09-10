import { friendlyError, safeUserMessage } from '@/lib/errors';

describe('friendlyError', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  afterAll(() => spy.mockRestore());

  it('maps auth credential failures', () => {
    expect(friendlyError({ code: 'auth/invalid-credential', message: 'x' })).toBe(
      'Incorrect email or password.',
    );
  });

  it('maps permission-denied', () => {
    expect(friendlyError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toBe(
      "You don't have access to do that.",
    );
  });

  it('maps missing Firestore index', () => {
    expect(
      friendlyError({
        code: 'failed-precondition',
        message: 'The query requires an index. You can create it here: https://console.firebase.google.com',
      }),
    ).toBe('Still getting things ready. Please try again in a moment.');
  });

  it('keeps safe API failed-precondition messages actionable', () => {
    expect(
      friendlyError({
        code: 'failed-precondition',
        message: 'The selected lapidary is not currently available.',
      }),
    ).toBe('The selected lapidary is not currently available.');
  });

  it('hides technical API failed-precondition messages', () => {
    expect(
      friendlyError({
        code: 'failed-precondition',
        message: 'Firestore failed-precondition internal error.',
      }),
    ).toBe('Something went wrong. Please try again.');
  });

  it('keeps short intentional app messages', () => {
    expect(friendlyError(new Error('Your account has been suspended.'))).toBe(
      'Your account has been suspended.',
    );
  });

  it('falls back for technical Firebase strings', () => {
    expect(friendlyError(new Error('Firebase: Error (auth/internal-error).'))).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('removes technical strings at the UI boundary', () => {
    expect(safeUserMessage('Firebase: Error (auth/internal-error).')).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
