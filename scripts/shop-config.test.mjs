import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyBrand, deploymentTitle } from './brand-build.mjs';
import { resolveFirebaseConfig } from './shop-env-resolve.mjs';
import { LITTLE_ROCK_FIREBASE, resolveServerFirebase } from '../netlify/functions/_shared/shop-auth.mjs';
import defaults from '../src/littleRockDefaults.json' with { type: 'json' };

const vegasName = 'Gameday Las Vegas Buying Tracker';

const firebaseEnvNames = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_DATABASE_URL',
];

function envGet(map) {
  return (name) => (Object.prototype.hasOwnProperty.call(map, name) ? map[name] : '');
}

test('server Firebase defaults match the client Little Rock defaults', () => {
  assert.deepEqual(LITTLE_ROCK_FIREBASE, defaults.firebase);
  assert.equal(defaults.shop.shopName, 'GameDay Sports Cards');
  assert.equal(defaults.shop.locationLabel, 'In Shop');
  assert.equal(defaults.shop.pageTitle, 'GameDay buying desk');
  const resolved = resolveServerFirebase({ getEnv: () => '' });
  assert.equal(resolved.error, '');
  assert.equal(resolved.projectId, defaults.firebase.projectId);
  assert.equal(resolved.databaseURL, defaults.firebase.databaseURL);
});

test('a shop name without Firebase settings does not use Little Rock on the server', () => {
  const resolved = resolveServerFirebase({
    getEnv: envGet({ SHOP_NAME: vegasName }),
  });
  assert.equal(resolved.apiKey, '');
  assert.equal(resolved.databaseURL, '');
  assert.match(resolved.error, /will not connect to the Little Rock project/);
  firebaseEnvNames.forEach((name) => assert.match(resolved.error, new RegExp(name)));
});

test('server Firebase settings can point at another project', () => {
  const resolved = resolveServerFirebase({
    getEnv: envGet({
      REACT_APP_SHOP_NAME: vegasName,
      REACT_APP_FIREBASE_API_KEY: 'vegas-key',
      REACT_APP_FIREBASE_AUTH_DOMAIN: 'vegas.firebaseapp.com',
      REACT_APP_FIREBASE_PROJECT_ID: 'vegas-project',
      REACT_APP_FIREBASE_STORAGE_BUCKET: 'vegas.appspot.com',
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '1',
      REACT_APP_FIREBASE_APP_ID: '1:1:web:abc',
      FIREBASE_DATABASE_URL: 'https://vegas-default-rtdb.firebaseio.com',
    }),
  });
  assert.equal(resolved.error, '');
  assert.equal(resolved.projectId, 'vegas-project');
  assert.equal(resolved.databaseURL, 'https://vegas-default-rtdb.firebaseio.com');
  assert.equal(resolved.apiKey, 'vegas-key');
});

test('the generated client config is Little Rock unless this build names another shop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shop-env-'));
  const littleRockFile = join(dir, 'little-rock.js');
  const vegasFile = join(dir, 'vegas.js');
  const base = spawnSync(process.execPath, ['scripts/write-shop-env.mjs', littleRockFile], {
    env: { PATH: process.env.PATH },
  });
  assert.equal(base.status, 0);
  const littleRock = readFileSync(littleRockFile, 'utf8');
  assert.match(littleRock, /GameDay Sports Cards/);
  assert.match(littleRock, /gameday-buying-tracker/);
  assert.doesNotMatch(littleRock, /Gameday Las Vegas Buying Tracker/);
  const vegas = spawnSync(process.execPath, ['scripts/write-shop-env.mjs', vegasFile], {
    env: {
      PATH: process.env.PATH,
      REACT_APP_SHOP_NAME: vegasName,
      REACT_APP_APP_TITLE: vegasName,
      REACT_APP_SHOP_SHORT_NAME: vegasName,
      REACT_APP_SHOP_ID: 'gameday-las-vegas',
      REACT_APP_FIREBASE_API_KEY: 'vegas-key',
      REACT_APP_FIREBASE_AUTH_DOMAIN: 'vegas.firebaseapp.com',
      REACT_APP_FIREBASE_PROJECT_ID: 'vegas-project',
      REACT_APP_FIREBASE_STORAGE_BUCKET: 'vegas.firebasestorage.app',
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '1',
      REACT_APP_FIREBASE_APP_ID: '1:1:web:vegas',
      REACT_APP_FIREBASE_DATABASE_URL: 'https://vegas-default-rtdb.firebaseio.com',
    },
  });
  assert.equal(vegas.status, 0);
  const vegasText = readFileSync(vegasFile, 'utf8');
  assert.match(vegasText, new RegExp(vegasName));
  assert.match(vegasText, /vegas-project/);
  assert.doesNotMatch(vegasText, /gameday-buying-tracker/);
  assert.doesNotMatch(vegasText, /GameDay Sports Cards/);
});

test('a partial Firebase config is refused before it can mix projects', () => {
  const result = resolveFirebaseConfig(
    { apiKey: 'not-a-real-key', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', databaseURL: '' },
    { fallback: { projectId: 'fallback-project' } },
  );
  assert.equal(result.firebaseConfig, null);
  assert.match(result.firebaseConfigError, /REACT_APP_FIREBASE_AUTH_DOMAIN/);
  assert.doesNotMatch(result.firebaseConfigError, /not-a-real-key/);
  assert.doesNotMatch(result.firebaseConfigError, /fallback-project/);
});
test('the built page title stays Little Rock unless a shop name is set', () => {
  assert.equal(deploymentTitle({}), '');
  const html = '<title>GameDay buying desk</title>';
  const manifest = { short_name: 'Buying desk', name: 'GameDay buying desk' };
  const untouched = applyBrand(html, manifest, '');
  assert.equal(untouched.changed, false);
  assert.equal(untouched.html, html);
  assert.equal(untouched.manifest.name, 'GameDay buying desk');
  assert.equal(untouched.manifest.short_name, 'Buying desk');
  const branded = applyBrand(html, manifest, vegasName);
  assert.equal(branded.changed, true);
  assert.equal(branded.html, `<title>${vegasName}</title>`);
  assert.equal(branded.manifest.name, vegasName);
  assert.equal(branded.manifest.short_name, vegasName);
});
