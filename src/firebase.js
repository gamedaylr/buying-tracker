import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { firebaseConfig, firebaseConfigError } from './shopEnv';

export { firebaseConfig, firebaseConfigError };

export const app = firebaseConfigError ? null : initializeApp(firebaseConfig);
export const secondaryApp = firebaseConfigError ? null : initializeApp(firebaseConfig, 'secondary');

export const auth = app ? getAuth(app) : null;
export const secondaryAuth = secondaryApp ? getAuth(secondaryApp) : null;
export const db = app ? getDatabase(app) : null;
export const secondaryDb = secondaryApp ? getDatabase(secondaryApp) : null;
export const firestore = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

const emulatorHost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname);

if (!firebaseConfigError && process.env.REACT_APP_USE_EMULATORS === 'true' && emulatorHost && !window.__GAMEDAY_EMULATORS__) {
  window.__GAMEDAY_EMULATORS__ = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  connectDatabaseEmulator(secondaryDb, '127.0.0.1', 9000);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
