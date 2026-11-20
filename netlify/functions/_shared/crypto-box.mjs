import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function sanitizeIdentity(payload) {
  const source = payload || {};
  const clip = (value, max) => String(value || '').trim().slice(0, max);
  return {
    idNumber: clip(source.idNumber, 40),
    dob: /^\d{4}-\d{2}-\d{2}$/.test(source.dob || '') ? source.dob : '',
    address: clip(source.address, 120),
    city: clip(source.city, 60),
    state: clip(source.state, 20),
    zip: clip(source.zip, 15),
  };
}

function decodeKey(keyB64) {
  const key = Buffer.from(String(keyB64 || ''), 'base64');
  if (key.length !== 32) {
    const error = new Error('ID encryption is not set up yet. Add IDENTITY_ENCRYPTION_KEY in Netlify. The ID photo can still be saved.');
    error.status = 503;
    throw error;
  }
  return key;
}

export function encryptJson(value, keyB64) {
  const key = decodeKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptJson(ciphertext, ivB64, keyB64) {
  const key = decodeKey(keyB64);
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(ciphertext, 'base64');
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}
