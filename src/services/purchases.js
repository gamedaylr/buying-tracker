import { get, push, ref, runTransaction, set, update } from 'firebase/database';
import { db } from '../firebase';
import {
  applyManagerEdit,
  auditEntry,
  buildPurchase,
  cashAmount,
  nextPurchaseNumberFrom,
  num,
  roundMoney,
} from '../lib/buying';
import { encryptIdentity } from './api';
import { compressImage, uploadImage } from './photos';

function stored(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function ensurePurchaseCounter(purchases) {
  const counterRef = ref(db, 'meta/nextPurchaseNumber');
  await runTransaction(counterRef, (current) => {
    if (typeof current === 'number') return current;
    return nextPurchaseNumberFrom(purchases);
  });
}

export async function reservePurchaseNumber() {
  // The first callback often sees null before the server value arrives.
  // Returning nothing would cancel the transaction, so guess and let it retry.
  const result = await runTransaction(ref(db, 'meta/nextPurchaseNumber'), (current) => {
    const value = typeof current === 'number' ? current : 0;
    return value + 1;
  });
  if (!result.committed || typeof result.snapshot.val() !== 'number') {
    throw new Error('Slip numbers are not set up yet. A manager needs to sign in once on this new site.');
  }
  return result.snapshot.val() - 1;
}

async function uploadGroup(files, folder, uid, purchaseId, lineItemId) {
  const saved = [];
  for (const file of files) {
    const blob = file.blob || await compressImage(file.file);
    const contentType = blob.type || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `purchases/${uid}/${purchaseId}/${folder}/${file.id}.${ext}`;
    await uploadImage(path, blob, contentType);
    saved.push({
      id: file.id,
      storagePath: path,
      contentType,
      uploadedAt: new Date().toISOString(),
      lineItemId: lineItemId || file.lineItemId || '',
    });
  }
  return saved;
}

export async function savePurchase({
  form,
  firebaseUser,
  profile,
  settings,
  seller,
  idFiles,
  cardFiles,
  paymentFiles,
  signatureBlob,
  lineItems,
  identity,
}) {
  const purchaseId = push(ref(db, 'purchases')).key;
  const sellerId = (seller && seller.id) || push(ref(db, 'sellers')).key;
  const uid = firebaseUser.uid;
  const uploaded = {
    cards: await uploadGroup(cardFiles || [], 'cards', uid, purchaseId),
    id: await uploadGroup(idFiles || [], 'id', uid, purchaseId),
    payment: await uploadGroup(paymentFiles || [], 'payment', uid, purchaseId),
    signature: null,
  };
  for (const item of lineItems || []) {
    if (!item.photoFile) continue;
    const [saved] = await uploadGroup(
      [{ id: item.id, file: item.photoFile, lineItemId: item.id }],
      'cards',
      uid,
      purchaseId,
    );
    if (saved) uploaded.cards.push(saved);
  }
  if (signatureBlob) {
    const [saved] = await uploadGroup(
      [{ id: 'signature', blob: signatureBlob }],
      'signature',
      uid,
      purchaseId,
    );
    uploaded.signature = saved ? {
      storagePath: saved.storagePath,
      contentType: saved.contentType,
      uploadedAt: saved.uploadedAt,
    } : null;
  }

  const purchaseNumber = await reservePurchaseNumber();
  const user = {
    uid,
    name: profile.name || firebaseUser.displayName || '',
    email: profile.email || firebaseUser.email || '',
  };
  const hasNewId = uploaded.id.length > 0;
  const purchase = buildPurchase({
    form,
    purchaseNumber,
    user,
    settings,
    seller: {
      id: sellerId,
      name: form.boughtFrom,
      phone: form.sellerPhone,
      email: form.sellerEmail,
      hasIdPhoto: Boolean(seller && seller.hasIdPhoto) || hasNewId,
    },
    photos: uploaded,
    lineItems: (lineItems || []).map((item) => ({
      ...item,
      photoPath: (uploaded.cards.find((photo) => photo.lineItemId === item.id) || {}).storagePath || '',
    })),
    userIsManager: profile.role === 'manager' || profile.role === 'admin',
  });

  let identityWarning = '';
  let cipher = null;
  const hasIdentity = identity && (identity.idNumber || identity.dob || identity.address);
  if (hasIdentity) {
    try {
      const token = await firebaseUser.getIdToken();
      cipher = await encryptIdentity(token, identity);
    } catch (error) {
      identityWarning = error.message || 'The ID number was not stored.';
    }
  }

  const now = new Date().toISOString();
  const sellerFields = {
    name: purchase.boughtFrom,
    phone: String(form.sellerPhone || '').trim(),
    phoneDigits: purchase.sellerPhone,
    email: purchase.sellerEmail,
    hasIdPhoto: Boolean(seller && seller.hasIdPhoto) || hasNewId,
    shopId: settings.shopId,
    updatedAt: now,
  };
  const auditId = push(ref(db, 'audit')).key;
  const updates = {
    [`purchases/${purchaseId}`]: stored(purchase),
    [`audit/${auditId}`]: auditEntry({
      action: 'create',
      purchaseId,
      purchase,
      user,
      shopId: settings.shopId,
      summary: `Logged slip #${purchase.purchaseNumber}`,
    }),
  };
  if (!seller || !seller.id) {
    updates[`sellers/${sellerId}`] = {
      ...sellerFields,
      createdAt: now,
      createdByUid: uid,
    };
  } else {
    Object.entries(sellerFields).forEach(([key, value]) => {
      updates[`sellers/${sellerId}/${key}`] = value;
    });
  }
  await update(ref(db), stored(updates));

  const cash = cashAmount(purchase);
  if (cash > 0) {
    await runTransaction(ref(db, `sellers/${sellerId}/cashByDate/${purchase.date}`), (current) => (
      roundMoney(num(current) + cash)
    ));
  }

  if (cipher && cipher.ciphertext) {
    await update(ref(db, `sellerPrivate/${sellerId}`), {
      idCiphertext: cipher.ciphertext,
      idIv: cipher.iv,
      idPhotoPath: (uploaded.id[0] && uploaded.id[0].storagePath) || '',
      shopId: settings.shopId,
      updatedByUid: uid,
      updatedAt: now,
    });
  } else if (uploaded.id[0]) {
    await update(ref(db, `sellerPrivate/${sellerId}`), {
      idPhotoPath: uploaded.id[0].storagePath,
      shopId: settings.shopId,
      updatedByUid: uid,
      updatedAt: now,
    });
  }

  return {
    purchase: { ...purchase, firebaseKey: purchaseId },
    sellerId,
    identityWarning,
  };
}

export async function saveManagerEdit(existing, form, lineItems, profile, settings) {
  const next = applyManagerEdit(existing, form, lineItems);
  if (!next.shopId) next.shopId = settings.shopId;
  if (!existing.loggedByUid) delete next.loggedByUid;
  if (!existing.loggedByName) delete next.loggedByName;
  if (!existing.loggedByEmail) delete next.loggedByEmail;
  const user = { uid: profile.uid, name: profile.name || '', email: profile.email || '' };
  const auditId = push(ref(db, 'audit')).key;
  await set(ref(db, `purchases/${existing.firebaseKey}`), stored(next));
  await update(ref(db), {
    [`audit/${auditId}`]: auditEntry({
      action: 'edit',
      purchaseId: existing.firebaseKey,
      purchase: next,
      user,
      shopId: settings.shopId,
      summary: `Edited slip #${next.purchaseNumber}`,
    }),
  });
}

export async function setPurchaseDeleted(purchase, profile, settings, deleted) {
  const user = { uid: profile.uid, name: profile.name || '', email: profile.email || '' };
  const auditId = push(ref(db, 'audit')).key;
  const now = new Date().toISOString();
  await update(ref(db), {
    [`purchases/${purchase.firebaseKey}/deleted`]: deleted,
    [`purchases/${purchase.firebaseKey}/deletedAt`]: deleted ? now : '',
    [`purchases/${purchase.firebaseKey}/deletedByUid`]: deleted ? user.uid : '',
    [`purchases/${purchase.firebaseKey}/deletedByName`]: deleted ? user.name : '',
    [`audit/${auditId}`]: auditEntry({
      action: deleted ? 'delete' : 'restore',
      purchaseId: purchase.firebaseKey,
      purchase,
      user,
      shopId: settings.shopId,
      summary: `${deleted ? 'Removed' : 'Restored'} slip #${purchase.purchaseNumber}`,
    }),
  });
}

export function rowsFromSnapshot(snapshot) {
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([firebaseKey, value]) => ({
    ...(value || {}),
    firebaseKey,
    id: firebaseKey,
  }));
}

export async function readPurchaseCounterReady() {
  const snap = await get(ref(db, 'meta/nextPurchaseNumber'));
  return snap.exists() && typeof snap.val() === 'number';
}
