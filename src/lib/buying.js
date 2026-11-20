/** Domain logic for the buying desk. No Firebase or DOM. */

export const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', cash: true },
  { key: 'cashFromSafe', label: 'Safe', cash: true },
  { key: 'cashApp', label: 'Cash App', cash: false },
  { key: 'venmo', label: 'Venmo', cash: false },
  { key: 'zelle', label: 'Zelle', cash: false },
  { key: 'paypal', label: 'PayPal', cash: false },
  { key: 'trade', label: 'Trade', cash: false },
  { key: 'storeCredit', label: 'Store credit', cash: false },
];

export const INVENTORY_STATUSES = [
  { value: 'bought', label: 'Bought' },
  { value: 'grading', label: 'Graded / sent out' },
  { value: 'listed', label: 'Listed' },
  { value: 'sold', label: 'Sold' },
];

export const FORM_8300_CASH_LIMIT = 10000;

/**
 * Defaults for this deployment. A manager can change every one of these
 * in settings. `shopId` is stamped on new records so a later version can
 * tell shops apart. This build does not switch shops or bill anyone.
 */
export const DEFAULT_SETTINGS = {
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

export function shopIdFromName(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'shop';
}

export function initialShopId(shopName) {
  if (!shopName || shopName.trim().toLowerCase() === DEFAULT_SETTINGS.shopName.toLowerCase()) {
    return DEFAULT_SETTINGS.shopId;
  }
  return shopIdFromName(shopName);
}

export function normalizeHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

export function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

export function money(value) {
  return `$${roundMoney(value).toFixed(2)}`;
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(isoDate, days) {
  const [y, m, d] = String(isoDate || '').split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Number(days || 0));
  return todayISO(date);
}

export function startOfWeekISO(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return todayISO(copy);
}

export function startOfMonthISO(date = new Date()) {
  return todayISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function formatDisplayDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m, d] = isoDate.split('-').map((part) => parseInt(part, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const threshold = Number(source.idThreshold);
  const cashPercent = Number(source.cashPercent);
  const creditPercent = Number(source.creditPercent);
  const approvalAmount = Number(source.approvalAmount);
  const holdDays = Number(source.holdDays);
  const shopName = String(source.shopName || '').trim() || DEFAULT_SETTINGS.shopName;
  const shopId = String(source.shopId || '').trim() || initialShopId(shopName);
  return {
    shopId,
    shopName,
    shopShortName: String(source.shopShortName || '').trim() || shopName.split(' ')[0] || DEFAULT_SETTINGS.shopShortName,
    tagline: String(source.tagline || '').trim() || DEFAULT_SETTINGS.tagline,
    accentColor: normalizeHex(source.accentColor, DEFAULT_SETTINGS.accentColor),
    idRequired: source.idRequired === false ? false : DEFAULT_SETTINGS.idRequired,
    idThreshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_SETTINGS.idThreshold,
    cashPercent: Number.isFinite(cashPercent) && cashPercent >= 0 && cashPercent <= 100
      ? cashPercent
      : DEFAULT_SETTINGS.cashPercent,
    creditPercent: Number.isFinite(creditPercent) && creditPercent >= 0 && creditPercent <= 100
      ? creditPercent
      : DEFAULT_SETTINGS.creditPercent,
    approvalAmount: Number.isFinite(approvalAmount) && approvalAmount >= 0
      ? approvalAmount
      : DEFAULT_SETTINGS.approvalAmount,
    holdDays: Number.isFinite(holdDays) && holdDays >= 0 && holdDays <= 365
      ? Math.round(holdDays)
      : DEFAULT_SETTINGS.holdDays,
  };
}

export function isManagerRole(role) {
  return role === 'manager' || role === 'admin';
}

export function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function computeOffers(comp, settings) {
  const normalized = normalizeSettings(settings);
  const base = num(comp);
  return {
    cashOffer: roundMoney((base * normalized.cashPercent) / 100),
    creditOffer: roundMoney((base * normalized.creditPercent) / 100),
    cashPercent: normalized.cashPercent,
    creditPercent: normalized.creditPercent,
  };
}

export function priceFromPercent(comp, percent) {
  return roundMoney((num(comp) * num(percent)) / 100);
}

export function agreedPercent(cost, comp) {
  const base = num(comp);
  if (base <= 0) return null;
  return roundMoney((num(cost) / base) * 100);
}

export function inferPayoutType(form) {
  if (form.payoutType === 'store_credit' || form.payoutType === 'cash') return form.payoutType;
  if (num(form.storeCredit) > 0 && num(form.storeCredit) >= num(form.cost) / 2) return 'store_credit';
  return 'cash';
}

export function approvalDecision({ cost, lotComp, payoutType, settings }) {
  const normalized = normalizeSettings(settings);
  const reasons = [];
  if (normalized.approvalAmount > 0 && num(cost) >= normalized.approvalAmount) {
    reasons.push(`The amount is ${money(cost)}, which is at or over the ${money(normalized.approvalAmount)} manager limit.`);
  }
  const percent = agreedPercent(cost, lotComp);
  if (percent != null) {
    const type = payoutType === 'store_credit' ? 'store_credit' : 'cash';
    const cap = type === 'store_credit' ? normalized.creditPercent : normalized.cashPercent;
    if (percent > cap + 0.009) {
      const label = type === 'store_credit' ? 'store credit' : 'cash';
      reasons.push(`This is ${percent.toFixed(1)}% of the comp, above the ${cap}% ${label} rate.`);
    }
  }
  return { needed: reasons.length > 0, reasons, percent };
}

export function idIsRequired({ cost, settings, sellerHasIdPhoto, newIdPhotoCount }) {
  const normalized = normalizeSettings(settings);
  if (!normalized.idRequired) return false;
  if (num(cost) < normalized.idThreshold) return false;
  if (newIdPhotoCount > 0) return false;
  if (sellerHasIdPhoto) return false;
  return true;
}

export function cashAmount(purchase) {
  return roundMoney(num(purchase.cash) + num(purchase.cashFromSafe));
}

export function form8300Status(priorCash, thisCash) {
  const prior = roundMoney(priorCash);
  const current = roundMoney(thisCash);
  const total = roundMoney(prior + current);
  return {
    prior,
    current,
    total,
    over: total > FORM_8300_CASH_LIMIT,
  };
}

export function emptyForm(user, settings) {
  const normalized = normalizeSettings(settings);
  return {
    date: todayISO(),
    lotComp: '',
    percentageBought: '',
    numCards: '',
    buyerName: user?.name || '',
    boughtFrom: '',
    sellerPhone: '',
    sellerEmail: '',
    payoutType: '',
    cash: '',
    cashFromSafe: '',
    cashApp: '',
    venmo: '',
    zelle: '',
    paypal: '',
    trade: '',
    storeCredit: '',
    cost: '',
    notes: '',
    inventoryStatus: 'bought',
    holdDays: normalized.holdDays ? String(normalized.holdDays) : '',
  };
}

export function lineItemsOf(purchase) {
  const raw = purchase && purchase.lineItems;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item, index) => ({ id: item.id || String(index), ...item }));
  return Object.entries(raw).map(([id, item]) => ({ id, ...(item || {}) }));
}

export function cardPhotosOf(purchase) {
  const cards = purchase && purchase.photos && purchase.photos.cards;
  if (!cards) return [];
  if (Array.isArray(cards)) return cards;
  return Object.entries(cards).map(([id, photo]) => ({ id, ...(photo || {}) }));
}

/**
 * Card photos keep an optional `tags` list for a later recognition pass.
 * Empty lists are omitted because Realtime Database does not store them.
 */
export function photoTags(photo) {
  if (!photo || photo.tags == null) return [];
  if (Array.isArray(photo.tags)) return photo.tags.filter(Boolean);
  return Object.values(photo.tags).filter(Boolean);
}

export function paymentLines(purchase) {
  return PAYMENT_METHODS
    .map((method) => ({ ...method, amount: roundMoney(purchase[method.key]) }))
    .filter((method) => method.amount > 0);
}

export function normalizeReceiptRequest(value) {
  return value === 'text' || value === 'email' ? value : 'none';
}

export function receiptChoiceLabel(value) {
  if (value === 'text') return 'Text';
  if (value === 'email') return 'Email';
  if (value === 'none') return 'No receipt';
  return 'Not recorded';
}

export function receiptContactError(choice, phone, email) {
  if (choice === 'text' && phoneDigits(phone).length < 10) return 'Enter the phone number for the text.';
  if (choice === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) {
    return 'Enter the email address for the receipt.';
  }
  return '';
}

/** Card count the seller is told. Line items win, then the number entered, then photos. */
export function cardsOnBuy(form, lineItems, extraPhotos) {
  const lines = lineItems || [];
  if (lines.length) {
    return lines.reduce((sum, item) => sum + Math.max(1, Math.round(num(item.quantity) || 1)), 0);
  }
  if (form && form.numCards !== '' && form.numCards != null) return Math.max(0, Math.round(num(form.numCards)));
  return extraPhotos || 0;
}

export function paymentSummary(purchase) {
  const lines = paymentLines(purchase);
  if (!lines.length) return '';
  return lines.map((line) => `${line.label} ${money(line.amount)}`).join(', ');
}

export function paymentsTotal(form) {
  return roundMoney(PAYMENT_METHODS.reduce((sum, method) => sum + num(form[method.key]), 0));
}

export function formatPercent(value) {
  const n = roundMoney(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

/** Percent of comp from the amount paid. Blank when either side is blank or comp is zero. */
export function percentText(cost, comp) {
  if (cost === '' || cost == null || comp === '' || comp == null) return '';
  const pct = agreedPercent(cost, comp);
  if (pct == null) return '';
  return formatPercent(pct);
}

export function defaultTenderKey(form) {
  return form && form.payoutType === 'store_credit' ? 'storeCredit' : 'cash';
}

export function applyCompInput(form, lotComp) {
  return {
    ...form,
    lotComp,
    percentageBought: percentText(form.cost, lotComp),
  };
}

/**
 * Cost paid is the deal. Until the payment boxes are edited by hand, the
 * single tender (cash, or store credit when that offer was chosen) mirrors it.
 */
export function applyCostInput(form, cost, { tendersFollowCost = false } = {}) {
  const next = {
    ...form,
    cost,
    percentageBought: percentText(cost, form.lotComp),
  };
  if (tendersFollowCost) {
    const key = defaultTenderKey(form);
    PAYMENT_METHODS.forEach((method) => {
      next[method.key] = method.key === key ? cost : '';
    });
  }
  return next;
}

export function applyPercentInput(form, percentageBought, { tendersFollowCost = false } = {}) {
  const cost = form.lotComp !== '' && form.lotComp != null && percentageBought !== ''
    ? String(priceFromPercent(form.lotComp, percentageBought))
    : form.cost;
  const next = applyCostInput(form, cost, { tendersFollowCost });
  next.percentageBought = percentageBought;
  return next;
}

export function tenderGap(form) {
  const costBlank = form.cost === '' || form.cost == null;
  const paid = paymentsTotal(form);
  const cost = roundMoney(form.cost);
  return {
    paid,
    cost,
    costBlank,
    matches: costBlank || Math.abs(paid - cost) < 0.009,
  };
}

function cleanLineItems(lineItems) {
  const map = {};
  (lineItems || []).forEach((item, index) => {
    const id = item.id || `line-${index + 1}`;
    const entry = {
      description: String(item.description || '').trim(),
      quantity: num(item.quantity) || 1,
      grader: item.grader || '',
      certNumber: String(item.certNumber || '').trim(),
      verificationStatus: item.verificationStatus || 'unchecked',
    };
    if (item.verification && typeof item.verification === 'object') {
      entry.verification = {
        player: item.verification.player || '',
        year: item.verification.year || '',
        setName: item.verification.setName || '',
        cardNumber: item.verification.cardNumber || '',
        grade: item.verification.grade || '',
        brand: item.verification.brand || '',
        source: item.verification.source || '',
        lookedUpAt: item.verification.lookedUpAt || '',
      };
    }
    if (item.photoPath) entry.photoPath = item.photoPath;
    map[id] = entry;
  });
  return map;
}

function cleanPhotos(photos) {
  const source = photos || {};
  const cleanGroup = (group) => {
    const map = {};
    (group || []).forEach((photo) => {
      if (!photo || !photo.storagePath) return;
      const id = photo.id || photo.storagePath;
      const entry = {
        storagePath: photo.storagePath,
        contentType: photo.contentType || 'image/jpeg',
        uploadedAt: photo.uploadedAt || new Date().toISOString(),
      };
      const tags = photoTags(photo);
      if (tags.length) entry.tags = tags;
      if (photo.lineItemId) entry.lineItemId = photo.lineItemId;
      map[id] = entry;
    });
    return map;
  };
  const result = {
    cards: cleanGroup(source.cards),
    id: cleanGroup(source.id),
    payment: cleanGroup(source.payment),
  };
  if (source.signature && source.signature.storagePath) {
    result.signature = {
      storagePath: source.signature.storagePath,
      contentType: source.signature.contentType || 'image/png',
      uploadedAt: source.signature.uploadedAt || new Date().toISOString(),
    };
  }
  return result;
}

export function buildPurchase({
  form,
  purchaseNumber,
  user,
  settings,
  seller,
  photos,
  lineItems,
  userIsManager,
  receiptRequested,
}) {
  const normalized = normalizeSettings(settings);
  const payoutType = inferPayoutType(form);
  const decision = approvalDecision({
    cost: form.cost,
    lotComp: form.lotComp,
    payoutType,
    settings: normalized,
  });
  const holdDays = form.holdDays === '' || form.holdDays == null
    ? normalized.holdDays
    : Math.max(0, Math.round(num(form.holdDays)));
  const offers = computeOffers(form.lotComp, normalized);
  const items = cleanLineItems(lineItems);
  const itemCount = Object.values(items).reduce((sum, item) => sum + num(item.quantity), 0);
  const needsReview = Object.values(items).some((item) => (
    item.verificationStatus === 'mismatch' || item.verificationStatus === 'not_found'
  ));
  const approvedNow = decision.needed && userIsManager;
  const percent = decision.percent != null ? decision.percent : num(form.percentageBought);
  const sellerName = String((seller && seller.name) || form.boughtFrom || '').trim();

  return {
    purchaseNumber: num(purchaseNumber),
    date: form.date,
    lotComp: num(form.lotComp),
    percentageBought: percent || 0,
    numCards: itemCount || num(form.numCards),
    buyerName: String(form.buyerName || '').trim(),
    boughtFrom: sellerName,
    sellerId: (seller && seller.id) || '',
    sellerPhone: phoneDigits((seller && seller.phone) || form.sellerPhone || ''),
    sellerEmail: String((seller && seller.email) || form.sellerEmail || '').trim(),
    cash: num(form.cash),
    cashFromSafe: num(form.cashFromSafe),
    venmo: num(form.venmo),
    cashApp: num(form.cashApp),
    zelle: num(form.zelle),
    paypal: num(form.paypal),
    trade: num(form.trade),
    storeCredit: num(form.storeCredit),
    cost: num(form.cost),
    notes: String(form.notes || '').trim(),
    receiptRequested: normalizeReceiptRequest(receiptRequested),
    shopId: normalized.shopId,
    timestamp: new Date().toISOString(),
    loggedByUid: user.uid,
    loggedByName: user.name || user.email || '',
    loggedByEmail: user.email || '',
    payoutType,
    cashOfferPercent: offers.cashPercent,
    creditOfferPercent: offers.creditPercent,
    cashOffer: offers.cashOffer,
    creditOffer: offers.creditOffer,
    agreedPercent: decision.percent == null ? 0 : decision.percent,
    approvalStatus: !decision.needed ? 'not_required' : (approvedNow ? 'approved' : 'pending'),
    approvalReasons: decision.reasons,
    approvedByUid: approvedNow ? user.uid : '',
    approvedByName: approvedNow ? (user.name || user.email || '') : '',
    approvedAt: approvedNow ? new Date().toISOString() : '',
    inventoryStatus: INVENTORY_STATUSES.some((status) => status.value === form.inventoryStatus)
      ? form.inventoryStatus
      : 'bought',
    holdDays,
    holdUntil: holdDays > 0 ? addDaysISO(form.date, holdDays) : '',
    idOnFile: Boolean(seller && seller.hasIdPhoto) || Boolean(photos && photos.id && photos.id.length),
    idReused: Boolean(seller && seller.hasIdPhoto) && !(photos && photos.id && photos.id.length),
    needsReview,
    deleted: false,
    lineItems: items,
    photos: cleanPhotos(photos),
  };
}

export function applyManagerEdit(existing, form, lineItems) {
  const payoutType = inferPayoutType(form);
  const holdDays = form.holdDays === '' || form.holdDays == null ? 0 : Math.max(0, Math.round(num(form.holdDays)));
  const items = cleanLineItems(lineItems);
  const itemCount = Object.values(items).reduce((sum, item) => sum + num(item.quantity), 0);
  const next = {
    ...existing,
    date: form.date,
    lotComp: num(form.lotComp),
    percentageBought: agreedPercent(form.cost, form.lotComp) || num(form.percentageBought),
    numCards: itemCount || num(form.numCards),
    buyerName: String(form.buyerName || '').trim(),
    boughtFrom: String(form.boughtFrom || '').trim(),
    sellerPhone: phoneDigits(form.sellerPhone || existing.sellerPhone || ''),
    sellerEmail: String(form.sellerEmail || '').trim(),
    cash: num(form.cash),
    cashFromSafe: num(form.cashFromSafe),
    venmo: num(form.venmo),
    cashApp: num(form.cashApp),
    zelle: num(form.zelle),
    paypal: num(form.paypal),
    trade: num(form.trade),
    storeCredit: num(form.storeCredit),
    cost: num(form.cost),
    notes: String(form.notes || '').trim(),
    payoutType,
    agreedPercent: agreedPercent(form.cost, form.lotComp) || 0,
    inventoryStatus: form.inventoryStatus || existing.inventoryStatus || 'bought',
    holdDays,
    holdUntil: holdDays > 0 ? addDaysISO(form.date, holdDays) : '',
    needsReview: Object.values(items).some((item) => (
      item.verificationStatus === 'mismatch' || item.verificationStatus === 'not_found'
    )) || Boolean(existing.needsReview && form.keepReview),
    lineItems: items,
    purchaseNumber: existing.purchaseNumber,
    timestamp: existing.timestamp,
    loggedByUid: existing.loggedByUid || '',
    loggedByName: existing.loggedByName || '',
    loggedByEmail: existing.loggedByEmail || '',
    deleted: Boolean(existing.deleted),
  };
  delete next.firebaseKey;
  return next;
}

export function formFromPurchase(purchase) {
  return {
    date: purchase.date || todayISO(),
    lotComp: purchase.lotComp ? String(purchase.lotComp) : '',
    percentageBought: purchase.percentageBought ? String(purchase.percentageBought) : '',
    numCards: purchase.numCards ? String(purchase.numCards) : '',
    buyerName: purchase.buyerName || '',
    boughtFrom: purchase.boughtFrom || '',
    sellerPhone: purchase.sellerPhone || '',
    sellerEmail: purchase.sellerEmail || '',
    payoutType: purchase.payoutType || '',
    cash: purchase.cash ? String(purchase.cash) : '',
    cashFromSafe: purchase.cashFromSafe ? String(purchase.cashFromSafe) : '',
    cashApp: purchase.cashApp ? String(purchase.cashApp) : '',
    venmo: purchase.venmo ? String(purchase.venmo) : '',
    zelle: purchase.zelle ? String(purchase.zelle) : '',
    paypal: purchase.paypal ? String(purchase.paypal) : '',
    trade: purchase.trade ? String(purchase.trade) : '',
    storeCredit: purchase.storeCredit ? String(purchase.storeCredit) : '',
    cost: purchase.cost != null ? String(purchase.cost) : '',
    notes: purchase.notes || '',
    inventoryStatus: purchase.inventoryStatus || 'bought',
    holdDays: purchase.holdDays ? String(purchase.holdDays) : '',
  };
}

export function validateBuy({ form, settings, sellerHasIdPhoto, newIdPhotoCount, lineItems }) {
  if (!form.date || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return 'Enter the date.';
  if (!String(form.buyerName || '').trim()) return 'Enter the buyer name.';
  if (!String(form.boughtFrom || '').trim()) return 'Enter the seller name.';
  if (form.cost === '' || form.cost == null) return 'Enter the cost.';
  if (num(form.cost) < 0) return 'Cost cannot be negative.';
  const normalized = normalizeSettings(settings);
  if (idIsRequired({
    cost: form.cost,
    settings: normalized,
    sellerHasIdPhoto,
    newIdPhotoCount,
  })) {
    return `Add a photo of the seller's ID. Buys of ${money(normalized.idThreshold)} or more need one unless an ID is already on file.`;
  }
  for (const item of lineItems || []) {
    if (item.lookupDetails && item.verificationStatus !== 'verified' && item.verificationStatus !== 'mismatch') {
      return `Cert ${item.certNumber || ''}: tap Matches or Doesn't match before saving.`.trim();
    }
  }
  return '';
}

export function findSellers(sellers, query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const digits = phoneDigits(q);
  return (sellers || []).filter((seller) => {
    const name = String(seller.name || '').toLowerCase();
    const phone = phoneDigits(seller.phone || seller.phoneDigits || '');
    const email = String(seller.email || '').toLowerCase();
    return name.includes(q) || email.includes(q) || (digits.length >= 3 && phone.includes(digits));
  }).slice(0, 8);
}

export function priorCashForSeller(seller, date) {
  if (!seller || !seller.cashByDate) return 0;
  return num(seller.cashByDate[date]);
}

export function matchesSearch(purchase, filters) {
  const f = filters || {};
  if (purchase.deleted && !f.includeDeleted) return false;
  if (f.onlyDeleted && !purchase.deleted) return false;
  if (f.pendingOnly && purchase.approvalStatus !== 'pending' && !purchase.needsReview) return false;
  if (f.status && f.status !== 'any') {
    const status = purchase.inventoryStatus || 'untracked';
    if (status !== f.status) return false;
  }
  if (f.dateFrom && String(purchase.date || '') < f.dateFrom) return false;
  if (f.dateTo && String(purchase.date || '') > f.dateTo) return false;
  if (f.seller) {
    const q = f.seller.trim().toLowerCase();
    const hay = `${purchase.boughtFrom || ''} ${purchase.sellerPhone || ''} ${purchase.sellerEmail || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.buyer) {
    const q = f.buyer.trim().toLowerCase();
    const hay = `${purchase.buyerName || ''} ${purchase.loggedByName || ''} ${purchase.loggedByEmail || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.amount != null && String(f.amount).trim() !== '') {
    const target = num(f.amount);
    const amounts = [num(purchase.cost), num(purchase.lotComp), ...PAYMENT_METHODS.map((method) => num(purchase[method.key]))];
    if (!amounts.some((amount) => Math.abs(amount - target) < 0.009)) return false;
  }
  if (f.paymentMethod && f.paymentMethod !== 'any') {
    if (num(purchase[f.paymentMethod]) <= 0) return false;
  }
  if (f.text) {
    const q = f.text.trim().toLowerCase();
    const items = lineItemsOf(purchase).map((item) => [
      item.description,
      item.grader,
      item.certNumber,
      item.verification && item.verification.player,
      item.verification && item.verification.setName,
      item.verification && item.verification.grade,
      item.verificationStatus,
    ].filter(Boolean).join(' ')).join(' ');
    const hay = [
      purchase.boughtFrom,
      purchase.buyerName,
      purchase.loggedByName,
      purchase.notes,
      purchase.date,
      purchase.purchaseNumber,
      purchase.sellerPhone,
      purchase.inventoryStatus,
      purchase.payoutType,
      items,
      paymentSummary(purchase),
    ].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function sumPurchases(list) {
  const rows = list || [];
  const totals = {
    slips: rows.length,
    cost: 0,
    cards: 0,
    pending: 0,
    cashDrawer: 0,
  };
  PAYMENT_METHODS.forEach((method) => {
    totals[method.key] = 0;
  });
  rows.forEach((purchase) => {
    totals.cost += num(purchase.cost);
    totals.cards += num(purchase.numCards);
    if (purchase.approvalStatus === 'pending' || purchase.needsReview) totals.pending += 1;
    PAYMENT_METHODS.forEach((method) => {
      totals[method.key] += num(purchase[method.key]);
    });
  });
  totals.cost = roundMoney(totals.cost);
  totals.cashDrawer = roundMoney(totals.cash + totals.cashFromSafe);
  PAYMENT_METHODS.forEach((method) => {
    totals[method.key] = roundMoney(totals[method.key]);
  });
  return totals;
}

export function summarize(purchases, { day, weekStart, monthStart }) {
  const active = (purchases || []).filter((purchase) => !purchase.deleted);
  return {
    day: sumPurchases(active.filter((purchase) => purchase.date === day)),
    week: sumPurchases(active.filter((purchase) => purchase.date >= weekStart && purchase.date <= day)),
    month: sumPurchases(active.filter((purchase) => purchase.date >= monthStart && purchase.date <= day)),
    all: sumPurchases(active),
  };
}

/**
 * Newest slip first. Slip number is the shop's sequence, so a higher number
 * is a later buy even when an older row has no timestamp. Ties use the time
 * the buy was logged, then the date on the slip.
 */
export function comparePurchasesNewestFirst(a, b) {
  const byNumber = num(b.purchaseNumber) - num(a.purchaseNumber);
  if (byNumber) return byNumber;
  const byTime = String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
  if (byTime) return byTime;
  const byDate = String(b.date || '').localeCompare(String(a.date || ''));
  if (byDate) return byDate;
  return String(b.firebaseKey || b.id || '').localeCompare(String(a.firebaseKey || a.id || ''));
}

export function sortPurchasesNewestFirst(purchases) {
  return [...(purchases || [])].sort(comparePurchasesNewestFirst);
}

export function purchaseInRange(purchase, { from, to, includeDeleted } = {}) {
  if (!purchase) return false;
  if (!includeDeleted && purchase.deleted) return false;
  const date = String(purchase.date || '');
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function tenderBreakdown(purchases, range) {
  const list = (purchases || []).filter((purchase) => purchaseInRange(purchase, range || {}));
  return PAYMENT_METHODS.map((method) => {
    const buys = list.filter((purchase) => num(purchase[method.key]) > 0);
    const total = roundMoney(buys.reduce((sum, purchase) => sum + num(purchase[method.key]), 0));
    return {
      key: method.key,
      label: method.label,
      total,
      count: buys.length,
    };
  });
}

export function purchasesForTender(purchases, range, methodKey) {
  return sortPurchasesNewestFirst(
    (purchases || []).filter((purchase) => (
      purchaseInRange(purchase, range || {}) && num(purchase[methodKey]) > 0
    )),
  );
}

export function cashAlerts(purchases) {
  const groups = new Map();
  (purchases || []).forEach((purchase) => {
    if (purchase.deleted) return;
    const cash = cashAmount(purchase);
    if (cash <= 0) return;
    const sellerKey = purchase.sellerId || String(purchase.boughtFrom || '').trim().toLowerCase() || 'unknown';
    const key = `${purchase.date}|${sellerKey}`;
    const current = groups.get(key) || {
      date: purchase.date,
      sellerId: purchase.sellerId || '',
      name: purchase.boughtFrom || 'Unknown seller',
      cash: 0,
      count: 0,
    };
    current.cash = roundMoney(current.cash + cash);
    current.count += 1;
    if (purchase.boughtFrom) current.name = purchase.boughtFrom;
    groups.set(key, current);
  });
  return [...groups.values()]
    .filter((group) => group.cash > FORM_8300_CASH_LIMIT)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function nextPurchaseNumberFrom(purchases) {
  return (purchases || []).reduce((max, purchase) => Math.max(max, num(purchase.purchaseNumber)), 0) + 1;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function purchasesToCsv(purchases) {
  const header = [
    'Purchase #', 'Date', 'Buyer', 'Logged by', 'Seller', 'Phone', 'Email', 'Comp', '% of comp',
    'Payout', 'Cards', 'Cash', 'Safe', 'Cash App', 'Venmo', 'Zelle', 'PayPal', 'Trade', 'Store credit',
    'Cost', 'Status', 'Approval', 'Hold until', 'Notes', 'Certs', 'Needs review', 'Deleted', 'Receipt',
  ];
  const rows = (purchases || []).map((purchase) => {
    const certs = lineItemsOf(purchase)
      .filter((item) => item.certNumber)
      .map((item) => `${item.grader || ''} ${item.certNumber}`.trim())
      .join('; ');
    return [
      purchase.purchaseNumber,
      purchase.date,
      purchase.buyerName,
      purchase.loggedByName || '',
      purchase.boughtFrom,
      purchase.sellerPhone || '',
      purchase.sellerEmail || '',
      purchase.lotComp,
      purchase.percentageBought,
      purchase.payoutType || '',
      purchase.numCards,
      purchase.cash,
      purchase.cashFromSafe,
      purchase.cashApp,
      purchase.venmo,
      purchase.zelle,
      purchase.paypal,
      purchase.trade,
      purchase.storeCredit || 0,
      purchase.cost,
      purchase.inventoryStatus || '',
      purchase.approvalStatus || '',
      purchase.holdUntil || '',
      purchase.notes || '',
      certs,
      purchase.needsReview ? 'yes' : '',
      purchase.deleted ? 'yes' : '',
      receiptChoiceLabel(purchase.receiptRequested),
    ].map(csvCell).join(',');
  });
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

export function complianceRows(purchases, privateBySellerId) {
  return (purchases || []).filter((purchase) => !purchase.deleted).map((purchase) => {
    const priv = (privateBySellerId && privateBySellerId[purchase.sellerId]) || {};
    const items = lineItemsOf(purchase);
    const itemText = items.length
      ? items.map((item) => {
        const bits = [item.quantity && item.quantity !== 1 ? `${item.quantity}x` : '', item.description, item.grader, item.certNumber && `#${item.certNumber}`];
        return bits.filter(Boolean).join(' ');
      }).join(' | ')
      : `${purchase.numCards || 0} cards`;
    const cardPaths = cardPhotosOf(purchase).map((photo) => photo.storagePath).filter(Boolean);
    const idPaths = purchase.photos && purchase.photos.id
      ? Object.values(purchase.photos.id).map((photo) => photo.storagePath).filter(Boolean)
      : [];
    return {
      date: purchase.date || '',
      purchaseNumber: purchase.purchaseNumber || '',
      seller: purchase.boughtFrom || '',
      phone: purchase.sellerPhone || '',
      email: purchase.sellerEmail || '',
      dob: priv.dob || '',
      idNumber: priv.idNumber || '',
      address: [priv.address, priv.city, priv.state, priv.zip].filter(Boolean).join(', '),
      idOnFile: purchase.idOnFile ? 'yes' : 'no',
      items: itemText,
      cardCount: purchase.numCards || 0,
      cash: num(purchase.cash),
      safe: num(purchase.cashFromSafe),
      cashTotal: cashAmount(purchase),
      storeCredit: num(purchase.storeCredit),
      otherPayout: paymentSummary(purchase),
      cost: num(purchase.cost),
      payoutType: purchase.payoutType || '',
      status: purchase.inventoryStatus || '',
      holdUntil: purchase.holdUntil || '',
      cardPhotoPaths: cardPaths.join(' '),
      idPhotoPaths: idPaths.join(' ') || priv.idPhotoPath || '',
      loggedBy: purchase.loggedByName || purchase.buyerName || '',
      approvedBy: purchase.approvedByName || '',
    };
  });
}

export function complianceToCsv(rows) {
  const header = [
    'Date', 'Purchase #', 'Seller', 'Phone', 'Email', 'DOB', 'ID number', 'Address', 'ID on file',
    'Items', 'Card count', 'Cash', 'Safe', 'Cash total', 'Store credit', 'Payout detail', 'Cost',
    'Payout type', 'Status', 'Hold until', 'Card photo paths', 'ID photo paths', 'Logged by', 'Approved by',
  ];
  const keys = [
    'date', 'purchaseNumber', 'seller', 'phone', 'email', 'dob', 'idNumber', 'address', 'idOnFile',
    'items', 'cardCount', 'cash', 'safe', 'cashTotal', 'storeCredit', 'otherPayout', 'cost',
    'payoutType', 'status', 'holdUntil', 'cardPhotoPaths', 'idPhotoPaths', 'loggedBy', 'approvedBy',
  ];
  const lines = (rows || []).map((row) => keys.map((key) => csvCell(row[key])).join(','));
  return [header.map(csvCell).join(','), ...lines].join('\n');
}

export function receiptText(purchase, shop) {
  const name = (shop && shop.shopName) || purchase.shopName || DEFAULT_SETTINGS.shopName;
  const lines = [
    String(name).toUpperCase(),
    `Receipt #${purchase.purchaseNumber || ''}`,
    formatDisplayDate(purchase.date),
    `Seller: ${purchase.boughtFrom || ''}`,
    purchase.sellerPhone ? `Phone: ${purchase.sellerPhone}` : '',
    `Buyer: ${purchase.buyerName || ''}`,
    purchase.loggedByName ? `Logged by: ${purchase.loggedByName}` : '',
    paymentSummary(purchase),
    `Total: ${money(purchase.cost)}`,
    purchase.numCards ? `Cards: ${purchase.numCards}` : '',
    ...lineItemsOf(purchase).map((item) => {
      const cert = item.certNumber ? ` ${item.grader || ''} #${item.certNumber}` : '';
      const flag = item.verificationStatus && item.verificationStatus !== 'unchecked' ? ` [${item.verificationStatus}]` : '';
      return `- ${item.description || 'Item'}${cert}${flag}`;
    }),
    purchase.approvalStatus === 'pending' ? 'PENDING MANAGER APPROVAL' : '',
    purchase.notes ? `Notes: ${purchase.notes}` : '',
    'Thank you.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function mailtoHref(purchase, shop) {
  const shortName = (shop && shop.shopShortName) || DEFAULT_SETTINGS.shopShortName;
  const subject = `${shortName} receipt #${purchase.purchaseNumber || ''}`;
  return `mailto:${encodeURIComponent(purchase.sellerEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptText(purchase, shop))}`;
}

export function smsHref(purchase, shop) {
  const phone = phoneDigits(purchase.sellerPhone || '');
  const body = receiptText(purchase, shop).slice(0, 900);
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}

export function auditEntry({ action, purchaseId, purchase, user, summary, shopId }) {
  return {
    action,
    shopId: shopId || purchase.shopId || '',
    purchaseId: purchaseId || '',
    purchaseNumber: purchase.purchaseNumber || '',
    at: new Date().toISOString(),
    byUid: user.uid,
    byName: user.name || user.email || '',
    summary: summary || `${action} slip #${purchase.purchaseNumber || ''}`,
  };
}

export function changedFields(before, after) {
  const keys = ['date', 'boughtFrom', 'buyerName', 'cost', 'lotComp', 'inventoryStatus', 'notes', 'holdUntil', 'approvalStatus'];
  return keys.filter((key) => String(before[key] ?? '') !== String(after[key] ?? ''));
}

export function sellerHistory(purchases, seller) {
  if (!seller) return [];
  const rows = (purchases || []).filter((purchase) => {
    if (purchase.deleted) return false;
    if (seller.id && purchase.sellerId === seller.id) return true;
    const name = String(seller.name || '').trim().toLowerCase();
    return name && String(purchase.boughtFrom || '').trim().toLowerCase() === name;
  });
  return sortPurchasesNewestFirst(rows);
}

export function statusLabel(value) {
  const found = INVENTORY_STATUSES.find((status) => status.value === value);
  return found ? found.label : (value ? String(value) : 'Not tracked');
}
