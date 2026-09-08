import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { apiRequestListener } from './entry';

test('Node HTTP adapter serves the Hono app without a Firebase deployment', async () => {
  const server = createServer(apiRequestListener);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    const body = (await response.json()) as { ok: boolean; service: string };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'gemfort-api');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
