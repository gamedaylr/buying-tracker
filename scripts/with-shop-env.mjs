import { spawn } from 'node:child_process';

/**
 * Copies unprefixed and VITE_ shop variables onto REACT_APP_ names so
 * Create React App can inline them. Does nothing when those REACT_APP_
 * variables are already set, which is how the Little Rock site is built.
 */
const aliases = [
  ['REACT_APP_SHOP_NAME', ['SHOP_NAME', 'VITE_SHOP_NAME']],
  ['REACT_APP_SHOP_ID', ['SHOP_ID', 'VITE_SHOP_ID']],
  ['REACT_APP_SHOP_SHORT_NAME', ['SHOP_SHORT_NAME', 'VITE_SHOP_SHORT_NAME']],
  ['REACT_APP_SHOP_TAGLINE', ['SHOP_TAGLINE', 'VITE_SHOP_TAGLINE']],
  ['REACT_APP_SHOP_ACCENT_COLOR', ['SHOP_ACCENT_COLOR', 'VITE_SHOP_ACCENT_COLOR']],
  ['REACT_APP_SHOP_LOCATION_LABEL', ['SHOP_LOCATION_LABEL', 'VITE_SHOP_LOCATION_LABEL']],
  ['REACT_APP_SHOP_LOGO_URL', ['SHOP_LOGO_URL', 'VITE_SHOP_LOGO_URL']],
  ['REACT_APP_APP_TITLE', ['APP_TITLE', 'VITE_APP_TITLE']],
  ['REACT_APP_FIREBASE_API_KEY', ['FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY']],
  ['REACT_APP_FIREBASE_AUTH_DOMAIN', ['FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN']],
  ['REACT_APP_FIREBASE_PROJECT_ID', ['FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID']],
  ['REACT_APP_FIREBASE_STORAGE_BUCKET', ['FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET']],
  ['REACT_APP_FIREBASE_MESSAGING_SENDER_ID', ['FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID']],
  ['REACT_APP_FIREBASE_APP_ID', ['FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID']],
  ['REACT_APP_FIREBASE_DATABASE_URL', ['FIREBASE_DATABASE_URL', 'VITE_FIREBASE_DATABASE_URL']],
];

function blank(value) {
  return value == null || String(value).trim() === '';
}

const env = { ...process.env };
aliases.forEach(([target, sources]) => {
  if (!blank(env[target])) return;
  sources.some((source) => {
    if (blank(env[source])) return false;
    env[target] = String(env[source]).trim();
    return true;
  });
});

if (blank(env.REACT_APP_APP_TITLE) && !blank(env.REACT_APP_SHOP_NAME)) {
  env.REACT_APP_APP_TITLE = String(env.REACT_APP_SHOP_NAME).trim();
}
if (blank(env.REACT_APP_SHOP_SHORT_NAME) && !blank(env.REACT_APP_SHOP_NAME)) {
  env.REACT_APP_SHOP_SHORT_NAME = String(env.REACT_APP_SHOP_NAME).trim();
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  process.stderr.write('Usage: node scripts/with-shop-env.mjs <command> [args]\n');
  process.exit(1);
}

const child = spawn(command, args, { env, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code == null ? 1 : code);
});
