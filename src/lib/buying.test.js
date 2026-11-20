import {
  DEFAULT_SETTINGS,
  agreedPercent,
  initialShopId,
  applyManagerEdit,
  approvalDecision,
  buildPurchase,
  cashAlerts,
  complianceToCsv,
  computeOffers,
  form8300Status,
  idIsRequired,
  matchesSearch,
  nextPurchaseNumberFrom,
  normalizeSettings,
  purchasesToCsv,
  receiptText,
  summarize,
  validateBuy,
} from './buying';

const user = { uid: 'staff-1', name: 'Alex', email: 'alex@gameday.test' };

function form(overrides) {
  return {
    date: '2026-11-20',
    lotComp: '100',
    percentageBought: '70',
    numCards: '2',
    buyerName: 'Alex',
    boughtFrom: 'Sam Seller',
    sellerPhone: '(501) 555-0100',
    sellerEmail: 'sam@example.com',
    payoutType: 'cash',
    cash: '70',
    cashFromSafe: '',
    cashApp: '',
    venmo: '',
    zelle: '',
    paypal: '',
    trade: '',
    storeCredit: '',
    cost: '70',
    notes: 'Two rookies',
    inventoryStatus: 'bought',
    holdDays: '',
    ...overrides,
  };
}

test('offers use the manager percentages', () => {
  const offers = computeOffers(200, { cashPercent: 70, creditPercent: 80 });
  expect(offers.cashOffer).toBe(140);
  expect(offers.creditOffer).toBe(160);
});

test('missing settings fall back to the shop defaults', () => {
  expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(normalizeSettings({ idRequired: false, idThreshold: 0 }).idRequired).toBe(false);
});

test('a buy at the ID threshold needs an ID photo', () => {
  expect(idIsRequired({ cost: 250, settings: DEFAULT_SETTINGS, sellerHasIdPhoto: false, newIdPhotoCount: 0 })).toBe(true);
  expect(idIsRequired({ cost: 249.99, settings: DEFAULT_SETTINGS, sellerHasIdPhoto: false, newIdPhotoCount: 0 })).toBe(false);
  expect(idIsRequired({ cost: 400, settings: DEFAULT_SETTINGS, sellerHasIdPhoto: true, newIdPhotoCount: 0 })).toBe(false);
  expect(idIsRequired({ cost: 400, settings: { idRequired: false }, sellerHasIdPhoto: false, newIdPhotoCount: 0 })).toBe(false);
});

test('offers above the set percent or over the dollar limit need approval', () => {
  const highPercent = approvalDecision({ cost: 90, lotComp: 100, payoutType: 'cash', settings: DEFAULT_SETTINGS });
  expect(highPercent.needed).toBe(true);
  const large = approvalDecision({ cost: 1000, lotComp: 2000, payoutType: 'cash', settings: DEFAULT_SETTINGS });
  expect(large.needed).toBe(true);
  const fine = approvalDecision({ cost: 70, lotComp: 100, payoutType: 'cash', settings: DEFAULT_SETTINGS });
  expect(fine.needed).toBe(false);
  expect(agreedPercent(80, 100)).toBe(80);
});

test('new purchases keep the original fields and stamp who logged them', () => {
  const purchase = buildPurchase({
    form: form(),
    purchaseNumber: 926,
    user,
    settings: DEFAULT_SETTINGS,
    seller: null,
    photos: { cards: [], id: [], payment: [] },
    lineItems: [],
    userIsManager: false,
  });
  expect(purchase.purchaseNumber).toBe(926);
  expect(purchase.buyerName).toBe('Alex');
  expect(purchase.boughtFrom).toBe('Sam Seller');
  expect(purchase.cash).toBe(70);
  expect(purchase.storeCredit).toBe(0);
  expect(purchase.loggedByUid).toBe('staff-1');
  expect(purchase.shopId).toBe('gameday');
  expect(purchase.deleted).toBe(false);
  expect(purchase.approvalStatus).toBe('not_required');
  expect(purchase.sellerPhone).toBe('5015550100');
});

test('a manager logging a large buy is stamped approved', () => {
  const purchase = buildPurchase({
    form: form({ cost: '1500', cash: '1500', lotComp: '3000' }),
    purchaseNumber: 5,
    user,
    settings: DEFAULT_SETTINGS,
    photos: { cards: [], id: [{ storagePath: 'purchases/staff-1/x/id/a.jpg' }], payment: [] },
    lineItems: [],
    userIsManager: true,
  });
  expect(purchase.approvalStatus).toBe('approved');
  expect(purchase.approvedByUid).toBe('staff-1');
});

test('staff large buys stay pending and ID is required in the form check', () => {
  const purchase = buildPurchase({
    form: form({ cost: '1500', cash: '1500', lotComp: '3000' }),
    purchaseNumber: 6,
    user,
    settings: DEFAULT_SETTINGS,
    photos: { cards: [], id: [{ storagePath: 'p' }], payment: [] },
    lineItems: [],
    userIsManager: false,
  });
  expect(purchase.approvalStatus).toBe('pending');
  expect(validateBuy({
    form: form({ cost: '300' }),
    settings: DEFAULT_SETTINGS,
    sellerHasIdPhoto: false,
    newIdPhotoCount: 0,
    lineItems: [],
  })).toMatch(/ID/);
});

test('search covers seller, cert, amount, payment, and date', () => {
  const purchase = buildPurchase({
    form: form({ notes: 'Charizard lot' }),
    purchaseNumber: 10,
    user,
    settings: DEFAULT_SETTINGS,
    photos: { cards: [], id: [], payment: [] },
    lineItems: [{ id: 'a', description: 'Charizard', grader: 'PSA', certNumber: '12345678', verificationStatus: 'verified' }],
    userIsManager: false,
  });
  expect(matchesSearch(purchase, { text: 'charizard' })).toBe(true);
  expect(matchesSearch(purchase, { text: '12345678' })).toBe(true);
  expect(matchesSearch(purchase, { seller: 'sam' })).toBe(true);
  expect(matchesSearch(purchase, { buyer: 'alex' })).toBe(true);
  expect(matchesSearch(purchase, { amount: '70' })).toBe(true);
  expect(matchesSearch(purchase, { paymentMethod: 'cash' })).toBe(true);
  expect(matchesSearch(purchase, { paymentMethod: 'venmo' })).toBe(false);
  expect(matchesSearch(purchase, { dateFrom: '2026-11-21' })).toBe(false);
  expect(matchesSearch({ ...purchase, deleted: true }, {})).toBe(false);
  expect(matchesSearch({ ...purchase, deleted: true }, { includeDeleted: true })).toBe(true);
});

test('legacy rows still summarize, export, and edit', () => {
  const legacy = {
    firebaseKey: 'old',
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
  };
  const summary = summarize([legacy], { day: '2026-06-09', weekStart: '2026-06-07', monthStart: '2026-06-01' });
  expect(summary.day.slips).toBe(1);
  expect(summary.day.cost).toBe(60);
  expect(summary.day.storeCredit).toBe(0);
  const csv = purchasesToCsv([legacy]);
  expect(csv).toContain('Pat');
  expect(csv).toContain('60');
  const edited = applyManagerEdit(legacy, {
    ...form({ boughtFrom: 'Pat', cost: '60', cash: '60', date: '2026-06-09', buyerName: 'Jim' }),
    inventoryStatus: 'listed',
  }, []);
  expect(edited.purchaseNumber).toBe(2);
  expect(edited.timestamp).toBe(legacy.timestamp);
  expect(edited.inventoryStatus).toBe('listed');
  expect(edited.firebaseKey).toBeUndefined();
});

test('cash over $10,000 in a day is flagged and exactly $10,000 is not', () => {
  expect(form8300Status(9000, 1000).over).toBe(false);
  expect(form8300Status(9000, 1000.01).over).toBe(true);
  const alerts = cashAlerts([
    { date: '2026-11-20', boughtFrom: 'Sam', sellerId: 's1', cash: 6000, cashFromSafe: 5000, deleted: false },
    { date: '2026-11-20', boughtFrom: 'Sam', sellerId: 's1', cash: 1, cashFromSafe: 0, deleted: false },
    { date: '2026-11-20', boughtFrom: 'Sam', sellerId: 's1', cash: 50, deleted: true },
  ]);
  expect(alerts).toHaveLength(1);
  expect(alerts[0].cash).toBe(11001);
});

test('the compliance file includes seller, items, and payout columns', () => {
  const purchase = buildPurchase({
    form: form(),
    purchaseNumber: 3,
    user,
    settings: DEFAULT_SETTINGS,
    seller: { id: 's1', name: 'Sam Seller', hasIdPhoto: true },
    photos: { cards: [{ id: 'c1', storagePath: 'purchases/staff-1/p/cards/c1.jpg' }], id: [], payment: [] },
    lineItems: [{ id: 'a', description: 'Rookie', quantity: 1, grader: 'PSA', certNumber: '99', verificationStatus: 'unchecked' }],
    userIsManager: false,
  });
  const csv = complianceToCsv([{
    date: purchase.date,
    purchaseNumber: purchase.purchaseNumber,
    seller: purchase.boughtFrom,
    phone: purchase.sellerPhone,
    email: '',
    dob: '1986-06-06',
    idNumber: 'D123',
    address: '1 Main',
    idOnFile: 'yes',
    items: 'Rookie PSA #99',
    cardCount: 1,
    cash: 70,
    safe: 0,
    cashTotal: 70,
    storeCredit: 0,
    otherPayout: 'Cash $70.00',
    cost: 70,
    payoutType: 'cash',
    status: 'bought',
    holdUntil: '',
    cardPhotoPaths: 'purchases/staff-1/p/cards/c1.jpg',
    idPhotoPaths: '',
    loggedBy: 'Alex',
    approvedBy: '',
  }]);
  expect(csv).toContain('ID number');
  expect(csv).toContain('D123');
  expect(csv).toContain('Card photo paths');
});

test('receipts use the shop name from settings, and a renamed shop gets its own id', () => {
  const purchase = buildPurchase({
    form: form(),
    purchaseNumber: 8,
    user,
    settings: { ...DEFAULT_SETTINGS, shopName: 'Other Shop', shopId: 'other-shop' },
    photos: { cards: [], id: [], payment: [] },
    lineItems: [],
    userIsManager: false,
  });
  expect(purchase.shopId).toBe('other-shop');
  expect(receiptText(purchase, { shopName: 'Other Shop' })).toMatch(/OTHER SHOP/);
  expect(initialShopId('GameDay Sports Cards')).toBe('gameday');
  expect(initialShopId('River City Cards')).toBe('river-city-cards');
});

test('receipt text and the next slip number stay compatible with old rows', () => {
  const purchase = buildPurchase({
    form: form({ payoutType: 'store_credit', storeCredit: '80', cash: '', cost: '80' }),
    purchaseNumber: 4,
    user,
    settings: DEFAULT_SETTINGS,
    photos: { cards: [], id: [], payment: [] },
    lineItems: [],
    userIsManager: true,
  });
  expect(receiptText(purchase)).toMatch(/store credit/i);
  expect(nextPurchaseNumberFrom([{ purchaseNumber: 2 }, { purchaseNumber: 925 }])).toBe(926);
});

test('csv cells that start with a formula character are neutralized', () => {
  const csv = purchasesToCsv([{
    purchaseNumber: 1,
    date: '2026-11-20',
    buyerName: '=cmd',
    boughtFrom: 'Sam',
    cost: 1,
    cash: 1,
    cashFromSafe: 0,
    venmo: 0,
    cashApp: 0,
    zelle: 0,
    paypal: 0,
    trade: 0,
    lotComp: 0,
    percentageBought: 0,
    numCards: 0,
  }]);
  expect(csv).toContain(`"'=cmd"`);
});
