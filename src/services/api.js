async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'The shop service did not answer.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function lookupCert(token, grader, certNumber) {
  return postJson('/api/cert-lookup', { token, grader, certNumber });
}

export function encryptIdentity(token, payload) {
  return postJson('/api/identity', { action: 'encrypt', token, payload });
}

export function decryptIdentity(token, items) {
  return postJson('/api/identity', { action: 'decrypt', token, items });
}
