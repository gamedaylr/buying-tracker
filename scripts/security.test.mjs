import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  ref,
  runTransaction,
  update,
} from 'firebase/database';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import { connectStorageEmulator, getDownloadURL, getStorage, ref as storageRef, uploadString } from 'firebase/storage';

const config = {
  apiKey: 'demo-key',
  authDomain: 'localhost',
  projectId: 'gameday-buying-tracker',
  storageBucket: 'gameday-buying-tracker.firebasestorage.app',
  appId: 'demo',
  databaseURL: 'https://gameday-buying-tracker-default-rtdb.firebaseio.com',
};

let sequence = 0;
const apps = [];

function client(label) {
  const app = initializeApp(config, `${label}-${sequence += 1}`);
  apps.push(app);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  return { auth, db, firestore, storage };
}

async function allow(label, promise) {
  try {
    return await promise;
  } catch (error) {
    throw new Error(`${label}: ${error.code || ''} ${error.message || error}`);
  }
}

async function denied(promise) {
  try {
    await promise;
  } catch (error) {
    const text = `${error.code || ''} ${error.message || ''}`;
    assert.match(text, /permission.denied|unauthorized/i);
    return;
  }
  assert.fail('expected permission denied');
}

function purchase(uid, overrides = {}) {
  return {
    purchaseNumber: 1,
    date: '2026-11-20',
    lotComp: 100,
    percentageBought: 70,
    numCards: 1,
    buyerName: 'Alex',
    boughtFrom: 'Sam Seller',
    sellerId: '',
    sellerPhone: '',
    sellerEmail: '',
    cash: 70,
    cashFromSafe: 0,
    venmo: 0,
    cashApp: 0,
    zelle: 0,
    paypal: 0,
    trade: 0,
    storeCredit: 0,
    cost: 70,
    notes: '',
    shopId: 'gameday',
    timestamp: '2026-11-20T12:00:00.000Z',
    loggedByUid: uid,
    loggedByName: 'Alex',
    loggedByEmail: 'alex@shop.test',
    payoutType: 'cash',
    cashOfferPercent: 70,
    creditOfferPercent: 80,
    cashOffer: 70,
    creditOffer: 80,
    agreedPercent: 70,
    approvalStatus: 'not_required',
    approvalReasons: [],
    approvedByUid: '',
    approvedByName: '',
    approvedAt: '',
    inventoryStatus: 'bought',
    holdDays: 0,
    holdUntil: '',
    idOnFile: false,
    idReused: false,
    needsReview: false,
    deleted: false,
    lineItems: {},
    photos: { cards: {}, id: {}, payment: {} },
    ...overrides,
  };
}

const settings = {
  shopId: 'gameday',
  shopName: 'GameDay Sports Cards',
  shopShortName: 'GameDay',
  tagline: 'Buying desk',
  accentColor: '#ed1c24',
  idRequired: true,
  idThreshold: 250,
  cashPercent: 70,
  creditPercent: 80,
  approvalAmount: 1000,
  holdDays: 0,
};

test('rules keep staff on their own buys and managers on the desk', async () => {
  const anon = client('anon');
  await denied(get(ref(anon.db, 'purchases')));
  const flag = await get(ref(anon.db, 'meta/initialized'));
  assert.equal(flag.exists(), false);

  const manager = client('manager');
  const managerCred = await createUserWithEmailAndPassword(manager.auth, 'boss@shop.test', 'secret1');
  const managerUid = managerCred.user.uid;
  await managerCred.user.getIdToken(true);
  await allow('bootstrap manager', update(ref(manager.db), {
    [`users/${managerUid}`]: {
      name: 'Boss',
      email: 'boss@shop.test',
      role: 'manager',
      disabled: false,
      shopId: 'gameday',
    },
  }));
  await allow('shop settings', update(ref(manager.db), {
    'meta/initialized': true,
    settings,
    'meta/nextPurchaseNumber': 10,
  }));
  await setDoc(doc(manager.firestore, 'users', managerUid), { role: 'manager', disabled: false, shopId: 'gameday' });
  await setDoc(doc(manager.firestore, 'meta', 'initialized'), { value: true });

  const intruder = client('intruder');
  const intruderCred = await createUserWithEmailAndPassword(intruder.auth, 'stranger@shop.test', 'secret1');
  await denied(update(ref(intruder.db), {
    [`users/${intruderCred.user.uid}`]: {
      name: 'Stranger',
      email: 'stranger@shop.test',
      role: 'manager',
      disabled: false,
    },
  }));

  const staff = client('staff');
  const staffCred = await createUserWithEmailAndPassword(staff.auth, 'alex@shop.test', 'secret1');
  const staffUid = staffCred.user.uid;
  await staffCred.user.getIdToken(true);
  await allow('add staff', update(ref(manager.db), {
    [`users/${staffUid}`]: {
      name: 'Alex',
      email: 'alex@shop.test',
      role: 'staff',
      disabled: false,
      shopId: 'gameday',
    },
  }));
  await setDoc(doc(manager.firestore, 'users', staffUid), { role: 'staff', disabled: false, shopId: 'gameday' });

  await denied(get(ref(staff.db, 'purchases')));
  await allow('small buy', update(ref(staff.db), {
    'purchases/small': purchase(staffUid),
    'sellers/sam': {
      name: 'Sam Seller',
      phone: '5015550100',
      phoneDigits: '5015550100',
      email: '',
      hasIdPhoto: false,
      shopId: 'gameday',
      updatedAt: '2026-11-20T12:00:00.000Z',
      createdAt: '2026-11-20T12:00:00.000Z',
      createdByUid: staffUid,
    },
    'audit/a1': {
      action: 'create',
      shopId: 'gameday',
      purchaseId: 'small',
      purchaseNumber: 1,
      at: '2026-11-20T12:00:00.000Z',
      byUid: staffUid,
      byName: 'Alex',
      summary: 'Logged slip #1',
    },
  }));
  const own = await get(ref(manager.db, 'purchases/small'));
  assert.equal(own.val().boughtFrom, 'Sam Seller');
  assert.equal(own.val().shopId, 'gameday');

  await denied(update(ref(staff.db), {
    'purchases/big': purchase(staffUid, {
      cost: 300, cash: 300, lotComp: 1000, percentageBought: 30, agreedPercent: 30, purchaseNumber: 2,
    }),
  }));
  const withId = purchase(staffUid, {
    cost: 300,
    cash: 300,
    lotComp: 1000,
    percentageBought: 30,
    agreedPercent: 30,
    purchaseNumber: 2,
    idOnFile: true,
    photos: { cards: {}, payment: {}, id: { front: { storagePath: `purchases/${staffUid}/big/id/front.jpg`, contentType: 'image/jpeg', uploadedAt: '2026-11-20T12:00:00.000Z' } } },
  });
  await allow('buy with id', update(ref(staff.db), { 'purchases/big': withId }));

  await denied(update(ref(staff.db), { 'purchases/small': null }));
  await denied(get(ref(staff.db, 'audit')));
  await allow('store sealed id', update(ref(staff.db), {
    'sellerPrivate/sam': {
      idCiphertext: 'sealed',
      idIv: 'iv',
      updatedByUid: staffUid,
      shopId: 'gameday',
    },
  }));
  await denied(get(ref(staff.db, 'sellerPrivate/sam')));
  const hidden = await get(ref(manager.db, 'sellerPrivate/sam'));
  assert.equal(hidden.val().idCiphertext, 'sealed');

  await denied(update(ref(staff.db), { 'settings/idRequired': false }));
  await allow('turn off id rule', update(ref(manager.db, 'settings'), { ...settings, idRequired: false }));
  await allow('buy without id', update(ref(staff.db), {
    'purchases/no-id': purchase(staffUid, {
      cost: 400, cash: 400, lotComp: 1000, percentageBought: 40, agreedPercent: 40, purchaseNumber: 3,
    }),
  }));

  await denied(runTransaction(ref(staff.db, 'meta/nextPurchaseNumber'), () => 999));
  const bumped = await runTransaction(ref(staff.db, 'meta/nextPurchaseNumber'), (current) => current + 1);
  assert.equal(bumped.snapshot.val(), 11);

  const idPath = `purchases/${staffUid}/pic/id/front.jpg`;
  await uploadString(storageRef(staff.storage, idPath), 'not-a-real-image', 'raw', { contentType: 'image/jpeg' });
  await denied(getDownloadURL(storageRef(staff.storage, idPath)));
  const managerUrl = await getDownloadURL(storageRef(manager.storage, idPath));
  assert.match(managerUrl, /front\.jpg|emulator|id|firebasestorage/);
  const cardPath = `purchases/${staffUid}/pic/cards/one.jpg`;
  await uploadString(storageRef(staff.storage, cardPath), 'card', 'raw', { contentType: 'image/jpeg' });
  assert.ok(await getDownloadURL(storageRef(staff.storage, cardPath)));

  await update(ref(manager.db), { [`users/${staffUid}/disabled`]: true });
  await signOut(staff.auth);
  await signInWithEmailAndPassword(staff.auth, 'alex@shop.test', 'secret1');
  await denied(update(ref(staff.db), {
    'purchases/after-disable': purchase(staffUid, { purchaseNumber: 4 }),
  }));

  const legacyResponse = await fetch('http://127.0.0.1:9000/purchases/legacy.json?ns=gameday-buying-tracker-default-rtdb', {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purchaseNumber: 2,
      date: '2026-06-09',
      lotComp: 100,
      percentageBought: 60,
      numCards: 4,
      buyerName: 'Jim',
      boughtFrom: 'Pat',
      cash: 60,
      cashFromSafe: 0,
      venmo: 0,
      cashApp: 0,
      zelle: 0,
      paypal: 0,
      trade: 0,
      cost: 60,
      timestamp: '2026-06-09T15:00:00.000Z',
    }),
  });
  assert.equal(legacyResponse.ok, true);
  const legacy = await get(ref(manager.db, 'purchases/legacy'));
  assert.equal(legacy.val().buyerName, 'Jim');
  assert.equal(legacy.val().cost, 60);
  await denied(get(ref(staff.db, 'purchases/legacy')));
  await Promise.all(apps.map((app) => deleteApp(app)));
});
