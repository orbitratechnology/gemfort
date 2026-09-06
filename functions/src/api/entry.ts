import { getRequestListener } from '@hono/node-server';
import { onRequest } from 'firebase-functions/v2/https';

import { REGION } from '../config';
import {
  travelpayoutsApiToken,
  travelpayoutsMarker,
  travelpayoutsProjectId,
} from '../flights';
import { apiApp } from './app';

export const apiRequestListener = getRequestListener(apiApp.fetch, {
  // Firebase's request/response objects already provide the Node primitives.
  overrideGlobalObjects: false,
});

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
