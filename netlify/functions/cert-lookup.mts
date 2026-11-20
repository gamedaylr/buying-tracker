import { lookupCert } from './_shared/certs.mjs';
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
  try {
    const result = await lookupCert({
      grader: body.grader,
      certNumber: body.certNumber,
      token: Netlify.env.get('PSA_API_TOKEN') || '',
      fetchImpl: fetch,
    });
    const status = result.httpStatus || 200;
    delete result.httpStatus;
    return json(result, status);
  } catch (error) {
    return json({ message: 'The cert lookup did not finish. Open the grader\'s own site.' }, 502);
  }
};

export const config = {
  path: '/api/cert-lookup',
  method: 'POST',
};
