/* global Netlify */

/**
 * Little Rock fallback for the cert and ID functions.
 * Keep LITTLE_ROCK_FIREBASE in sync with src/littleRockDefaults.json.
 * A site that sets a shop name, or only some Firebase keys, does not use
 * the Little Rock project.
 */
export const LITTLE_ROCK_FIREBASE = {
  apiKey: 'AIzaSyAjHoxB4h09Ame44C5MowR_IrbqNdANH8E',
  authDomain: 'gameday-buying-tracker.firebaseapp.com',
  projectId: 'gameday-buying-tracker',
  storageBucket: 'gameday-buying-tracker.firebasestorage.app',
  messagingSenderId: '363561073964',
  appId: '1:363561073964:web:f96c0e8b485f76796e0089',
  databaseURL: 'https://gameday-buying-tracker-default-rtdb.firebaseio.com',
};

const BRANDING_NAMES = [
  ['REACT_APP_SHOP_NAME', 'SHOP_NAME', 'VITE_SHOP_NAME'],
  ['REACT_APP_SHOP_ID', 'SHOP_ID', 'VITE_SHOP_ID'],
  ['REACT_APP_SHOP_SHORT_NAME', 'SHOP_SHORT_NAME', 'VITE_SHOP_SHORT_NAME'],
  ['REACT_APP_SHOP_TAGLINE', 'SHOP_TAGLINE', 'VITE_SHOP_TAGLINE'],
  ['REACT_APP_SHOP_ACCENT_COLOR', 'SHOP_ACCENT_COLOR', 'VITE_SHOP_ACCENT_COLOR'],
  ['REACT_APP_SHOP_LOCATION_LABEL', 'SHOP_LOCATION_LABEL', 'VITE_SHOP_LOCATION_LABEL'],
  ['REACT_APP_SHOP_LOGO_URL', 'SHOP_LOGO_URL', 'VITE_SHOP_LOGO_URL'],
  ['REACT_APP_APP_TITLE', 'APP_TITLE', 'VITE_APP_TITLE'],
];

const FIREBASE_NAMES = [
  ['apiKey', 'REACT_APP_FIREBASE_API_KEY', 'FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'REACT_APP_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'REACT_APP_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'REACT_APP_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'REACT_APP_FIREBASE_APP_ID', 'FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'],
  ['databaseURL', 'REACT_APP_FIREBASE_DATABASE_URL', 'FIREBASE_DATABASE_URL', 'VITE_FIREBASE_DATABASE_URL'],
];

function setupError(missingNames) {
  const list = missingNames.join(', ');
  return `This site's Firebase settings are incomplete (${list}). Set every REACT_APP_FIREBASE_* variable, then redeploy. This site will not connect to the Little Rock project.`;
}

export function resolveServerFirebase({ getEnv }) {
  const read = (...names) => {
    for (const name of names) {
      const value = getEnv(name);
      if (value != null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };
  const brandingTouched = BRANDING_NAMES.some((names) => read(...names));
  const values = {};
  const missing = [];
  FIREBASE_NAMES.forEach(([key, ...names]) => {
    const value = read(...names);
    values[key] = value;
    if (!value) missing.push(names[0]);
  });
  if (missing.length === FIREBASE_NAMES.length && !brandingTouched) {
    return { ...LITTLE_ROCK_FIREBASE, error: '' };
  }
  if (missing.length) {
    return {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      databaseURL: '',
      error: setupError(missing),
    };
  }
  return { ...values, error: '' };
}

function netlifyValue(name) {
  if (typeof Netlify === 'undefined' || !Netlify.env || typeof Netlify.env.get !== 'function') return '';
  const value = Netlify.env.get(name);
  return value == null ? '' : String(value);
}

export const serverFirebase = resolveServerFirebase({
  getEnv(name) {
    const fromNetlify = netlifyValue(name);
    if (fromNetlify.trim()) return fromNetlify;
    const fromProcess = process.env[name];
    return fromProcess == null ? '' : String(fromProcess);
  },
});

export async function verifyShopUser(idToken, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (serverFirebase.error && !options.apiKey && !options.databaseUrl) {
    return deny(500, serverFirebase.error);
  }
  const apiKey = options.apiKey || serverFirebase.apiKey;
  const databaseUrl = options.databaseUrl || serverFirebase.databaseURL;
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
