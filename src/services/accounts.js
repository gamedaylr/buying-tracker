import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { get, push, ref, update } from 'firebase/database';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, firestore, secondaryAuth, secondaryDb } from '../firebase';
import { isManagerRole } from '../lib/buying';

async function mirrorRole(uid, profile) {
  await setDoc(doc(firestore, 'users', uid), {
    role: profile.role,
    disabled: Boolean(profile.disabled),
    shopId: profile.shopId || '',
  }, { merge: true });
}

export async function bootstrapManager({ shop, name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  const uid = cred.user.uid;
  const profile = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'manager',
    disabled: false,
    shopId: shop.shopId,
    createdAt: new Date().toISOString(),
  };
  await update(ref(db), { [`users/${uid}`]: profile });
  await mirrorRole(uid, profile);
  await setDoc(doc(firestore, 'meta', 'initialized'), { value: true });
  await update(ref(db), {
    'meta/initialized': true,
    settings: shop,
  });
  return cred.user;
}

export async function createShopUser({ name, email, password, role, shopId }) {
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
  const uid = cred.user.uid;
  await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
  await signOut(secondaryAuth);
  const profile = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: role === 'manager' ? 'manager' : 'staff',
    disabled: false,
    shopId: shopId || '',
    createdAt: new Date().toISOString(),
  };
  await update(ref(db), { [`users/${uid}`]: profile });
  await mirrorRole(uid, profile);
  return profile;
}

export async function setUserDisabled(uid, disabled) {
  await update(ref(db), { [`users/${uid}/disabled`]: Boolean(disabled) });
  const snap = await get(ref(db, `users/${uid}`));
  if (snap.exists()) await mirrorRole(uid, snap.val());
}

export async function approveWithManagerLogin({ purchaseId, email, password }) {
  const cred = await signInWithEmailAndPassword(secondaryAuth, email.trim(), password);
  try {
    const uid = cred.user.uid;
    const profSnap = await get(ref(secondaryDb, `users/${uid}`));
    const prof = profSnap.val();
    if (!prof || prof.disabled || !isManagerRole(prof.role)) {
      throw new Error('That login is not an active manager.');
    }
    const purchaseSnap = await get(ref(secondaryDb, `purchases/${purchaseId}`));
    if (!purchaseSnap.exists()) throw new Error('That buy is not on file.');
    const purchase = purchaseSnap.val();
    const now = new Date().toISOString();
    const auditId = push(ref(secondaryDb, 'audit')).key;
    await update(ref(secondaryDb), {
      [`purchases/${purchaseId}/approvalStatus`]: 'approved',
      [`purchases/${purchaseId}/approvedByUid`]: uid,
      [`purchases/${purchaseId}/approvedByName`]: prof.name || email.trim(),
      [`purchases/${purchaseId}/approvedAt`]: now,
      [`audit/${auditId}`]: {
        action: 'approve',
        shopId: purchase.shopId || prof.shopId || '',
        purchaseId,
        purchaseNumber: purchase.purchaseNumber || '',
        at: now,
        byUid: uid,
        byName: prof.name || email.trim(),
        summary: `Approved slip #${purchase.purchaseNumber || ''}`,
      },
    });
    return prof.name || email.trim();
  } finally {
    await signOut(secondaryAuth);
  }
}
