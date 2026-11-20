import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyAjHoxB4h09Ame44C5MowR_IrbqNdANH8E',
  authDomain: 'gameday-buying-tracker.firebaseapp.com',
  projectId: 'gameday-buying-tracker',
  storageBucket: 'gameday-buying-tracker.firebasestorage.app',
  messagingSenderId: '363561073964',
  appId: '1:363561073964:web:f96c0e8b485f76796e0089',
  databaseURL: 'https://gameday-buying-tracker-default-rtdb.firebaseio.com',
};

export const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, 'secondary');

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const db = getDatabase(app);
export const secondaryDb = getDatabase(secondaryApp);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

const emulatorHost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname);

if (process.env.REACT_APP_USE_EMULATORS === 'true' && emulatorHost && !window.__GAMEDAY_EMULATORS__) {
  window.__GAMEDAY_EMULATORS__ = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  connectDatabaseEmulator(secondaryDb, '127.0.0.1', 9000);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
