import { DEFAULT_LOCATION, DEFAULT_SETTINGS } from './lib/buying';
import defaults from './littleRockDefaults.json';
import { firebaseConfig, firebaseConfigError, pageTitle } from './shopEnv';

test('Little Rock stays the default when no shop env is set', () => {
  expect(DEFAULT_SETTINGS).toMatchObject({
    shopId: 'gameday',
    shopName: 'GameDay Sports Cards',
    shopShortName: 'GameDay',
    tagline: 'Buying desk',
    accentColor: '#ed1c24',
  });
  expect(DEFAULT_LOCATION).toBe('In Shop');
  expect(pageTitle({ shopShortName: 'GameDay', shopName: 'GameDay Sports Cards' })).toBe('GameDay buying desk');
  expect(pageTitle({ shopShortName: 'Counter' })).toBe('Counter buying desk');
  expect(firebaseConfig).toEqual(defaults.firebase);
  expect(firebaseConfigError).toBe('');
});
