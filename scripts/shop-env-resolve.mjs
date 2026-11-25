export const FIREBASE_ENV_KEYS = [
  ['apiKey', 'REACT_APP_FIREBASE_API_KEY'],
  ['authDomain', 'REACT_APP_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'REACT_APP_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'REACT_APP_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'REACT_APP_FIREBASE_APP_ID'],
  ['databaseURL', 'REACT_APP_FIREBASE_DATABASE_URL'],
];

export function firebaseSetupError(missingNames) {
  const list = missingNames.join(', ');
  return `This site's Firebase settings are incomplete (${list}). Set every REACT_APP_FIREBASE_* variable, then redeploy. This site will not connect to the Little Rock project.`;
}

/**
 * No Firebase values and no shop branding: use `fallback` (Little Rock).
 * Any branding, or only some Firebase keys: refuse that fallback.
 */
export function resolveFirebaseConfig(values, { brandingTouched = false, fallback } = {}) {
  const missing = FIREBASE_ENV_KEYS.filter(([key]) => !String(values[key] || '').trim()).map(([, envName]) => envName);
  const provided = FIREBASE_ENV_KEYS.length - missing.length;
  if (provided === 0 && !brandingTouched) {
    return { firebaseConfig: { ...fallback }, firebaseConfigError: '' };
  }
  if (provided !== FIREBASE_ENV_KEYS.length) {
    return { firebaseConfig: null, firebaseConfigError: firebaseSetupError(missing) };
  }
  const firebaseConfig = {};
  FIREBASE_ENV_KEYS.forEach(([key]) => {
    firebaseConfig[key] = String(values[key]).trim();
  });
  return { firebaseConfig, firebaseConfigError: '' };
}
