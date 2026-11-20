import { decryptJson, encryptJson, sanitizeIdentity } from './_shared/crypto-box.mjs';
import { verifyShopUser } from './_shared/shop-auth.mjs';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return json({ message: 'Bad request' }, 400);
  }
  const user = await verifyShopUser(body.token);
  if (!user.ok) return json({ message: user.message }, user.status);
  const key = Netlify.env.get('IDENTITY_ENCRYPTION_KEY') || '';
  try {
    if (body.action === 'encrypt') {
      const payload = sanitizeIdentity(body.payload);
      if (!payload.idNumber && !payload.dob && !payload.address) {
        return json({ message: 'Nothing private to store.' }, 400);
      }
      return json(encryptJson(payload, key), 200);
    }
    if (body.action === 'decrypt') {
      if (!user.manager) return json({ message: 'Only a manager can read ID numbers.' }, 403);
      const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      const results = items.map((item) => {
        try {
          return { id: item.id, payload: decryptJson(item.ciphertext, item.iv, key) };
        } catch (error) {
          return { id: item.id, payload: null };
        }
      });
      return json({ results }, 200);
    }
    return json({ message: 'Unknown action' }, 400);
  } catch (error) {
    const status = error.status || 500;
    const message = status === 503
      ? error.message
      : 'The ID number could not be stored.';
    return json({ message }, status);
  }
};

export const config = {
  path: '/api/identity',
  method: 'POST',
};
