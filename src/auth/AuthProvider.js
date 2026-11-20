import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { get, onValue, ref } from 'firebase/database';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, firestore } from '../firebase';
import { isManagerRole, normalizeSettings } from '../lib/buying';
import { plainError } from '../lib/errors';
import { ensurePurchaseCounter, rowsFromSnapshot } from '../services/purchases';

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export default function AuthProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [initialized, setInitialized] = useState(undefined);
  const [configError, setConfigError] = useState('');
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [sellers, setSellers] = useState([]);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setFirebaseUser(user);
    setAuthReady(true);
  }), []);

  useEffect(() => onValue(ref(db, 'meta/initialized'), (snapshot) => {
    setInitialized(snapshot.val() === true);
    setConfigError('');
  }, (error) => {
    setInitialized(null);
    setConfigError(plainError(error));
  }), []);

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(undefined);
      return undefined;
    }
    return onValue(ref(db, `users/${firebaseUser.uid}`), (snapshot) => {
      setProfile(snapshot.exists() ? { uid: firebaseUser.uid, ...snapshot.val() } : null);
    }, () => setProfile(null));
  }, [firebaseUser]);

  useEffect(() => {
    if (profile && profile.disabled) signOut(auth);
  }, [profile]);

  const active = Boolean(firebaseUser && profile && !profile.disabled);

  useEffect(() => {
    if (!active) return undefined;
    return onValue(ref(db, 'settings'), (snapshot) => {
      setSettings(normalizeSettings(snapshot.val()));
    }, () => setSettings(normalizeSettings(null)));
  }, [active]);

  useEffect(() => {
    if (!active) {
      setSellers([]);
      return undefined;
    }
    return onValue(ref(db, 'sellers'), (snapshot) => {
      setSellers(rowsFromSnapshot(snapshot));
    }, () => setSellers([]));
  }, [active]);

  useEffect(() => {
    if (!active || !isManagerRole(profile.role)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await setDoc(doc(firestore, 'users', profile.uid), {
          role: profile.role,
          disabled: Boolean(profile.disabled),
          shopId: settings.shopId,
        }, { merge: true });
        await setDoc(doc(firestore, 'meta', 'initialized'), { value: true }, { merge: true });
      } catch (error) {
        if (!cancelled) console.error(error);
      }
      try {
        const snap = await get(ref(db, 'purchases'));
        if (!cancelled) await ensurePurchaseCounter(rowsFromSnapshot(snap));
      } catch (error) {
        if (!cancelled) console.error(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, profile, settings.shopId]);

  const status = !authReady || initialized === undefined || (firebaseUser && profile === undefined)
    ? 'loading'
    : configError && initialized == null
      ? 'blocked'
      : active
        ? 'ready'
        : firebaseUser && profile === null
          ? 'missing'
          : initialized === false
            ? 'setup'
            : 'signedout';

  const value = useMemo(() => ({
    status,
    configError,
    firebaseUser,
    profile,
    settings,
    sellers,
    signOutShop: () => signOut(auth),
  }), [status, configError, firebaseUser, profile, settings, sellers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
