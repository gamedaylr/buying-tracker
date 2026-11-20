import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'crypto';
import { decryptJson, encryptJson, sanitizeIdentity } from '../netlify/functions/_shared/crypto-box.mjs';
import { lookupCert, mapPsaCert } from '../netlify/functions/_shared/certs.mjs';

const key = randomBytes(32).toString('base64');

test('ID numbers round-trip through encryption and are not stored as plaintext', () => {
  const payload = sanitizeIdentity({ idNumber: 'D1234567', dob: '1986-06-06', address: '1 Main', city: 'Little Rock', state: 'AR', zip: '72201' });
  const sealed = encryptJson(payload, key);
  assert.equal(sealed.ciphertext.includes('D1234567'), false);
  assert.deepEqual(decryptJson(sealed.ciphertext, sealed.iv, key), payload);
});

test('a bad encryption key is rejected', () => {
  assert.throws(() => encryptJson({ idNumber: 'x' }, 'abc'), /IDENTITY_ENCRYPTION_KEY/);
});

test('PSA details are mapped and other graders only return official links', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      status: 200,
      json: async () => ({
        PSACert: { CertNumber: 55, Subject: 'Ken Griffey Jr.', YearIssued: '1989', Brand: 'Upper Deck', CardNumber: '1', CardGrade: '10' },
        IsValidRequest: true,
      }),
    };
  };
  const psa = await lookupCert({ grader: 'PSA', certNumber: '55', token: 'secret-token', fetchImpl });
  assert.equal(psa.mode, 'details');
  assert.equal(psa.details.player, 'Ken Griffey Jr.');
  assert.equal(calls[0].includes('secret-token'), false);
  assert.equal(calls[0].includes('GetByCertNumber/55'), true);
  const bgs = await lookupCert({ grader: 'BGS', certNumber: '0018', token: '', fetchImpl });
  assert.equal(bgs.mode, 'link');
  assert.equal(bgs.url.includes('beckett.com'), true);
  const missing = mapPsaCert({ PSACert: null, ServerMessage: 'No data found' });
  assert.equal(missing.found, false);
});

test('a missing PSA token does not call PSA', async () => {
  let called = false;
  const result = await lookupCert({
    grader: 'PSA',
    certNumber: '9',
    token: '',
    fetchImpl: async () => { called = true; return { status: 200, json: async () => ({}) }; },
  });
  assert.equal(called, false);
  assert.equal(result.httpStatus, 503);
  assert.match(result.url, /psacard\.com/);
});
