const PUBLIC_API_KEY = 'AIzaSyAjHoxB4h09Ame44C5MowR_IrbqNdANH8E';
const DATABASE_URL = 'https://gameday-buying-tracker-default-rtdb.firebaseio.com';

export async function verifyShopUser(idToken, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const apiKey = options.apiKey || PUBLIC_API_KEY;
  const databaseUrl = options.databaseUrl || DATABASE_URL;
  if (!idToken) return deny(401, 'Sign in is required.');
  const lookup = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const lookupBody = await lookup.json().catch(() => ({}));
  const uid = lookupBody.users && lookupBody.users[0] && lookupBody.users[0].localId;
  if (!lookup.ok || !uid) return deny(401, 'Sign in is required.');
  const userRes = await fetchImpl(`${databaseUrl}/users/${uid}.json?auth=${encodeURIComponent(idToken)}`);
  const profile = await userRes.json().catch(() => null);
  if (!userRes.ok || !profile || profile.error || profile.disabled) {
    return deny(403, 'This login cannot use shop tools.');
  }
  const role = profile.role;
  if (role !== 'staff' && role !== 'manager' && role !== 'admin') {
    return deny(403, 'This login cannot use shop tools.');
  }
  return { ok: true, uid, role, manager: role === 'manager' || role === 'admin' };
}

function deny(status, message) {
  return { ok: false, status, message };
}
