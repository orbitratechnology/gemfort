import type { AuthUser } from '@/lib/firebase/auth-types';

jest.mock('@/lib/firebase/auth', () => ({
  getIdToken: jest.fn(),
}));

jest.mock('@/lib/firebase/config', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/lib/firebase/app-check', () => ({
  getFirebaseAppCheckToken: jest.fn(async () => 'app-check-token'),
}));

import {
  ApiClientError,
  callApi,
  type ApiClientDependencies,
} from '../api-client';

const user = {} as AuthUser;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function dependencies(
  request: jest.MockedFunction<typeof fetch>,
): ApiClientDependencies {
  return {
    getCurrentUser: () => user,
    getIdToken: jest.fn(async (_user, forceRefresh) =>
      forceRefresh ? 'refreshed-token' : 'cached-token',
    ),
    getAppCheckToken: jest.fn(async () => 'app-check-token'),
    request,
  };
}

describe('callApi', () => {
  const previousBaseUrl = process.env.EXPO_PUBLIC_GEMFORT_API_BASE_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GEMFORT_API_BASE_URL = 'https://api.example.test/';
  });

  afterAll(() => {
    if (previousBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_GEMFORT_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_GEMFORT_API_BASE_URL = previousBaseUrl;
    }
  });

  it('fails closed when no App Check provider is configured', async () => {
    const request = jest.fn<typeof fetch>();
    const deps = dependencies(request);
    deps.getAppCheckToken = undefined;

    await expect(
      callApi('/v1/flights/search', { origin: 'CMB' }, {}, deps),
    ).rejects.toMatchObject({
      code: 'app-check/unavailable',
      status: 0,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends Firebase Auth and App Check headers and unwraps canonical data', async () => {
    const request = jest.fn<typeof fetch>().mockResolvedValue(
      response({ data: { offers: [] }, meta: { requestId: 'req-1' } }),
    );
    const deps = dependencies(request);

    await expect(
      callApi<{ offers: [] }, { origin: string }>(
        '/v1/flights/search',
        { origin: 'CMB' },
        { retryAuthOn401: true },
        deps,
      ),
    ).resolves.toEqual({ offers: [] });

    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/v1/flights/search',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cached-token',
          'X-Firebase-AppCheck': 'app-check-token',
        }),
      }),
    );
  });

  it('refreshes the Firebase ID token once after a 401', async () => {
    const request = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: { code: 'unauthenticated' } }, 401))
      .mockResolvedValueOnce(response({ data: { offers: [] } }));
    const deps = dependencies(request);

    await expect(
      callApi<{ offers: [] }, { origin: string }>(
        '/v1/flights/search',
        { origin: 'CMB' },
        { retryAuthOn401: true },
        deps,
      ),
    ).resolves.toEqual({ offers: [] });

    expect(deps.getIdToken).toHaveBeenNthCalledWith(1, user, false);
    expect(deps.getIdToken).toHaveBeenNthCalledWith(2, user, true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('supports the DELETE method used by account and AP removal routes', async () => {
    const request = jest.fn<typeof fetch>().mockResolvedValue(
      response({ data: { ok: true } }),
    );
    const deps = dependencies(request);

    await expect(
      callApi<{ ok: true }, undefined>('/v1/account', undefined, { method: 'DELETE' }, deps),
    ).resolves.toEqual({ ok: true });

    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/v1/account',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('maps canonical API errors without exposing response internals', async () => {
    const request = jest.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          error: {
            code: 'permission-denied',
            message: 'Only the owner can continue.',
            requestId: 'req-2',
          },
        },
        403,
      ),
    );
    const deps = dependencies(request);

    const promise = callApi('/v1/flights/search', {}, { retryAuthOn401: false }, deps);
    await expect(promise).rejects.toBeInstanceOf(ApiClientError);
    await expect(promise).rejects.toMatchObject({
      code: 'permission-denied',
      status: 403,
      requestId: 'req-2',
    });
  });
});
