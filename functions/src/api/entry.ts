import { onRequest } from 'firebase-functions/v2/https';
import type { getRequestListener } from '@hono/node-server';

import { REGION } from '../config';
import {
  travelpayoutsApiToken,
  travelpayoutsMarker,
  travelpayoutsProjectId,
} from '../flights';

// Keep the full API route graph out of Firebase's deployment-time discovery.
type ApiRequestListener = ReturnType<typeof getRequestListener>;

let apiRequestListenerPromise: Promise<ApiRequestListener> | undefined;

function loadApiRequestListener(): Promise<ApiRequestListener> {
  if (!apiRequestListenerPromise) {
    apiRequestListenerPromise = Promise.all([
      import('@hono/node-server'),
      import('./app'),
    ]).then(([{ getRequestListener }, { apiApp }]) =>
      getRequestListener(apiApp.fetch, {
        // Firebase's request/response objects already provide the Node primitives.
        overrideGlobalObjects: false,
      }),
    );
  }
  return apiRequestListenerPromise;
}

export const apiRequestListener: ApiRequestListener = (request, response) => {
  return loadApiRequestListener().then(
    (listener) => listener(request, response),
    (error: unknown) => {
      console.error('gemfort-api-initialization-failed', error);
      response.statusCode = 500;
      response.end('The API could not be initialized.');
    },
  );
};

/**
 * Deployment adapter for the consolidated API.
 *
 * This export is the consolidated client-facing API; Firebase triggers remain
 * independently deployed from the root function exports.
 */
export const gemfortApi = onRequest(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    cpu: 1,
    minInstances: 0,
    maxInstances: 10,
    concurrency: 40,
    secrets: [
      travelpayoutsApiToken,
      travelpayoutsMarker,
      travelpayoutsProjectId,
    ],
  },
  (request, response) => apiRequestListener(request, response),
);
