/**
 * Firestore rules integration checks via Rules Unit Testing REST API.
 * Uses Application Default Credentials against project gemfort.
 *
 * Usage: node scripts/test-firestore-rules.mjs
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function getAccessToken() {
  const r = spawnSync('gcloud', ['auth', 'application-default', 'print-access-token'], {
    encoding: 'utf8',
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || 'Failed to get ADC token via gcloud');
  }
  return r.stdout.trim();
}

const rules = readFileSync(resolve('firestore.rules'), 'utf8');
const token = getAccessToken();

const traderUid = 'c7wb4fj6YoUIu7iNccrn07HmbIw2';
const otherUid = 'h8pxF9en5ETXqxAvLnyQ2MtyWHt2';

const testCases = [
  {
    expectation: 'ALLOW',
    request: {
      auth: null,
      method: 'get',
      path: '/databases/(default)/documents/businesses/qa-trader-biz',
    },
    resource: {
      data: {
        verificationStatus: 'verified',
        isActive: true,
        ownerUid: traderUid,
      },
    },
  },
  {
    expectation: 'DENY',
    request: {
      auth: null,
      method: 'get',
      path: '/databases/(default)/documents/businesses/pending-biz',
    },
    resource: {
      data: {
        verificationStatus: 'none',
        isActive: true,
        ownerUid: traderUid,
      },
    },
  },
  {
    expectation: 'ALLOW',
    request: {
      auth: { uid: traderUid, token: { sub: traderUid, firebase: { sign_in_provider: 'password' } } },
      method: 'get',
      path: `/databases/(default)/documents/users/${traderUid}`,
    },
    resource: {
      data: {
        uid: traderUid,
        role: 'trader',
        isSuspended: false,
        isActive: true,
        verificationStatus: 'verified',
      },
    },
  },
  {
    expectation: 'DENY',
    request: {
      auth: { uid: otherUid, token: { sub: otherUid, firebase: { sign_in_provider: 'password' } } },
      method: 'get',
      path: `/databases/(default)/documents/users/${traderUid}`,
    },
    resource: {
      data: {
        uid: traderUid,
        role: 'trader',
        isSuspended: false,
        isActive: true,
        verificationStatus: 'verified',
      },
    },
  },
  {
    expectation: 'ALLOW',
    request: {
      auth: null,
      method: 'get',
      path: '/databases/(default)/documents/certificates/qa-cert-GF-2026-0001',
    },
    resource: {
      data: {
        visibility: 'public',
        certificateNumber: 'GF-2026-0001',
        labUid: 'STnr3bKtrfel7MpKNB7qglAqClF3',
      },
    },
  },
];

const payload = {
  source: { files: [{ name: 'firestore.rules', content: rules }] },
  testSuite: { testCases },
};

const res = await fetch('https://firebaserules.googleapis.com/v1/projects/gemfort:test', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': 'gemfort',
  },
  body: JSON.stringify(payload),
});

const body = await res.json();
if (!res.ok) {
  console.error('Rules test API error', res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}

let failed = 0;
for (const [i, result] of (body.testResults ?? []).entries()) {
  const ok = result.state === 'SUCCESS';
  const label = testCases[i]?.expectation;
  console.log(`${ok ? 'PASS' : 'FAIL'} case ${i + 1} expect=${label} state=${result.state}`);
  if (!ok) {
    failed += 1;
    console.log(JSON.stringify(result, null, 2));
  }
}

if (failed > 0) {
  console.error(`\n${failed} rules test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${(body.testResults ?? []).length} rules tests passed`);
