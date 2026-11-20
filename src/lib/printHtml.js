import { formatDisplayDate, lineItemsOf, money, paymentLines, paymentSummary, statusLabel } from './buying';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SCREEN_TABLE_CSS = `
  @media (max-width: 700px) {
    table, thead, tbody, th, td, tr { display: block; width: 100%; }
    thead { display: none; }
    tr { border: 1px solid #ccc; border-radius: 10px; margin: 0 0 10px; padding: 8px; }
    td { border: 0; padding: 4px 0; }
    td::before { content: attr(data-label); font-weight: 700; display: block; font-size: 12px; color: #444; }
  }
  @media print {
    table { display: table !important; width: 100%; border-collapse: collapse; }
    thead { display: table-header-group !important; }
    tbody { display: table-row-group !important; }
    tr { display: table-row !important; border: 0; margin: 0; padding: 0; }
    th, td { display: table-cell !important; }
    td::before { content: none !important; }
  }
`;

const PRINT_CHROME = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  .print-bar { font-family: Arial, sans-serif; padding: 12px; text-align: center; }
  .print-bar button { font-size: 16px; min-height: 44px; padding: 8px 18px; }
  @media print { .print-bar { display: none !important; } }
</style>`;

/** Adds a Print button, and optionally prints when the page finishes loading. */
export function printableDocument(html, { autoPrint = false, trackLabel = false } = {}) {
  const script = trackLabel || autoPrint
    ? `<script>(function(){
        var opened=false;
        function tell(result){
          try{
            if(!window.opener||window.opener.closed)return;
            var origin='*';
            try{origin=window.opener.location.origin;}catch(e){}
            window.opener.postMessage({source:'gameday-label',result:result},origin);
          }catch(e){}
        }
        window.addEventListener('beforeprint',function(){opened=true;tell('dialog-opened');});
        window.addEventListener('afterprint',function(){tell(opened?'dialog-closed':'skipped');setTimeout(function(){window.close();},200);});
        ${autoPrint ? "window.addEventListener('load',function(){try{window.focus();window.print();}catch(e){tell('skipped');}});" : ''}
      })();</script>`
    : '';
  const bar = '<div class="print-bar"><button type="button" onclick="window.print()">Print</button></div>';
  let next = String(html || '');
  if (next.includes('</head>')) next = next.replace('</head>', `${PRINT_CHROME}</head>`);
  else next = `${PRINT_CHROME}${next}`;
  if (next.includes('<body>')) next = next.replace('<body>', `<body>${bar}`);
  else next = `${bar}${next}`;
  if (next.includes('</body>')) next = next.replace('</body>', `${script}</body>`);
  else next = `${next}${script}`;
  return next;
}

function clipText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function formatSlipPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 10) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return String(value || '').trim();
}

function slipClock(purchase) {
  if (!purchase || !purchase.timestamp) return '';
  const date = new Date(purchase.timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function itemAmount(item) {
  const keys = ['amount', 'price', 'lineCost', 'cost', 'paid'];
  for (const key of keys) {
    if (item && item[key] != null && item[key] !== '') return money(item[key]);
  }
  return '';
}

function itemTitle(item) {
  const description = String(item.description || '').trim();
  const verification = item.verification || {};
  const named = [verification.year, verification.setName, verification.player].filter(Boolean).join(' ');
  const title = description || named || 'Card';
  const cert = [item.grader, verification.grade, item.certNumber ? `#${item.certNumber}` : ''].filter(Boolean).join(' ');
  return { title, cert };
}

/**
 * How many item rows fit above the money and signature on a 4x6 label.
 * Extra tenders and a pending flag take lines away from the list.
 */
export function slipItemBudget(purchase) {
  const tenders = paymentLines(purchase || {}).length;
  let rows = 16;
  if (tenders > 2) rows -= Math.min(8, tenders - 2);
  if (purchase && purchase.approvalStatus === 'pending') rows -= 1;
  return Math.max(4, rows);
}

/** Rows that fit on the label, plus how many cards were left off. */
export function planSlipItems(purchase, { maxRows } = {}) {
  const limit = maxRows == null ? slipItemBudget(purchase) : maxRows;
  const built = lineItemsOf(purchase).map((item) => {
    const qty = Math.max(1, Math.round(Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1) || 1);
    const { title, cert } = itemTitle(item);
    const amount = itemAmount(item);
    const text = clipText([title, cert].filter(Boolean).join(' · '), amount ? 34 : 46);
    return { qty, text, amount, cards: qty };
  }).filter((row) => row.text);

  if (!built.length) {
    const cards = Math.max(0, Math.round(Number(purchase && purchase.numCards) || 0));
    const note = clipText(purchase && purchase.notes, 60);
    if (!note && !cards) return { rows: [], moreCards: 0 };
    const text = note && cards
      ? `${note} · ${cards} card${cards === 1 ? '' : 's'}`
      : (note || `${cards} card${cards === 1 ? '' : 's'}`);
    return { rows: [{ qty: 0, text, amount: '', cards }], moreCards: 0 };
  }

  if (built.length <= limit) return { rows: built, moreCards: 0 };
  const keep = Math.max(1, limit - 1);
  const hidden = built.slice(keep);
  return {
    rows: built.slice(0, keep),
    moreCards: hidden.reduce((sum, row) => sum + row.cards, 0),
  };
}

/**
 * One 4x6 thermal label. The shop name is text, not the color logo, so a
 * black-and-white Rollo print stays sharp. The full receipt is separate.
 */
export function slipHtml(purchase, { shopName, signatureUrl } = {}) {
  const source = purchase || {};
  const when = formatDisplayDate(source.date);
  const clock = slipClock(source);
  const staff = source.loggedByName || source.buyerName || '';
  const staffLabel = source.loggedByName ? 'Logged by' : (staff ? 'Buyer' : '');
  const phone = formatSlipPhone(source.sellerPhone);
  const planned = planSlipItems(source);
  const items = planned.rows.map((row) => (
    `<div class="item"><span class="qty">${row.qty > 0 ? `${row.qty}×` : ''}</span><span class="desc">${escapeHtml(row.text)}</span>${row.amount ? `<span class="amt">${escapeHtml(row.amount)}</span>` : ''}</div>`
  )).join('');
  const more = planned.moreCards > 0
    ? `<div class="more">and ${planned.moreCards} more card${planned.moreCards === 1 ? '' : 's'}, see receipt</div>`
    : '';
  const tenders = paymentLines(source).map((line) => (
    `<div class="tender"><span>${escapeHtml(line.label)}</span><span>${money(line.amount)}</span></div>`
  )).join('');
  const comp = Number(source.lotComp) > 0
    ? `<div class="tender"><span>${escapeHtml(String(Number(source.percentageBought) || 0))}% of ${money(source.lotComp)} comp</span></div>`
    : '';
  const pending = source.approvalStatus === 'pending'
    ? '<div class="flag">PENDING APPROVAL</div>'
    : '';
  const signature = signatureUrl
    ? `<img src="${escapeHtml(signatureUrl)}" alt="Seller signature">`
    : '<div class="sign-line"></div>';
  const shop = shopName || source.shopName || 'Shop';
  return `<!DOCTYPE html><html><head><title>Slip ${escapeHtml(source.purchaseNumber || '')}</title>
    <style>
      @page { size: 4in 6in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { font-family: Arial, Helvetica, sans-serif; }
      .slip {
        width: 4in; height: 5.96in; margin: 0;
        padding: 0.1in 0.12in 0.08in;
        overflow: hidden; background: #fff; color: #000;
        display: flex; flex-direction: column;
      }
      .shop { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
      .num { font-size: 28px; font-weight: 800; line-height: 1; margin: 1px 0 2px; }
      .when, .who { font-size: 12px; font-weight: 700; line-height: 1.25; }
      .rule { border-top: 2px solid #000; margin: 4px 0; }
      .k { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; }
      .seller { font-size: 15px; font-weight: 800; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .phone { font-size: 13px; font-weight: 700; }
      .items { overflow: hidden; }
      .item, .tender, .total, .more { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
      .item { font-size: 12px; font-weight: 700; line-height: 1.2; margin: 1px 0; }
      .qty { width: 0.34in; flex: none; }
      .desc { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .amt { flex: none; }
      .more { font-size: 12px; font-weight: 800; margin-top: 2px; }
      .total { font-size: 22px; font-weight: 800; line-height: 1; }
      .tender { font-size: 12px; font-weight: 700; line-height: 1.25; }
      .flag { margin-top: 3px; border: 2px solid #000; text-align: center; font-size: 12px; font-weight: 800; padding: 1px 0; }
      .sign { margin-top: auto; padding-top: 4px; }
      .sign img { display: block; height: 0.46in; max-width: 2.4in; object-fit: contain; object-position: left center; background: #fff; }
      .sign-line { height: 0.38in; border-bottom: 2px solid #000; }
      .sign-label { font-size: 10px; font-weight: 800; letter-spacing: 0.04em; margin-top: 1px; }
      @media print {
        html, body { width: 4in; height: 6in; overflow: hidden; }
        .print-bar { display: none !important; }
      }
    </style></head><body><div class="slip">
      <div class="shop">${escapeHtml(shop)}</div>
      <div class="num">#${escapeHtml(source.purchaseNumber || '')}</div>
      <div class="when">${escapeHtml(when)}${clock ? ` · ${escapeHtml(clock)}` : ''}</div>
      ${staff ? `<div class="who">${escapeHtml(staffLabel)} ${escapeHtml(staff)}</div>` : ''}
      <div class="rule"></div>
      <div class="k">SELLER</div>
      <div class="seller">${escapeHtml(source.boughtFrom || 'No seller name')}</div>
      ${phone ? `<div class="phone">${escapeHtml(phone)}</div>` : ''}
      <div class="rule"></div>
      <div class="items">
        ${items || '<div class="item"><span class="desc">No cards listed</span></div>'}
        ${more}
      </div>
      <div class="pay">
        ${pending}
        <div class="rule"></div>
        <div class="total"><span>COST</span><span>${money(source.cost || 0)}</span></div>
        ${tenders}
        ${comp}
      </div>
      <div class="sign">${signature}<div class="sign-label">SELLER SIGNATURE</div></div>
    </div></body></html>`;
}

export function receiptHtml(purchase, { logoUrl, signatureUrl, shopName } = {}) {
  const items = lineItemsOf(purchase).map((item) => {
    const cert = item.certNumber ? `${item.grader || ''} #${escapeHtml(item.certNumber)}` : '';
    const official = item.verification
      ? [item.verification.year, item.verification.setName, item.verification.player, item.verification.grade].filter(Boolean).join(' · ')
      : '';
    const flag = item.verificationStatus && item.verificationStatus !== 'unchecked'
      ? item.verificationStatus.replace('_', ' ')
      : '';
    return `<tr><td data-label="Item">${escapeHtml(item.description || 'Item')}</td><td data-label="Cert">${cert}</td><td data-label="Lookup">${escapeHtml(official)}</td><td data-label="Check">${escapeHtml(flag)}</td></tr>`;
  }).join('');
  const payments = paymentLines(purchase).map((line) => (
    `<li>${escapeHtml(line.label)}: ${money(line.amount)}</li>`
  )).join('');
  return `<!DOCTYPE html><html><head><title>Receipt #${escapeHtml(purchase.purchaseNumber)}</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 24px; }
      header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #ed1c24; padding-bottom: 8px; }
      img { height: 52px; }
      h1 { font-family: Arial, sans-serif; font-size: 20px; margin: 0; letter-spacing: 0.04em; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-family: Arial, sans-serif; font-size: 13px; }
      td, th { border-bottom: 1px solid #ccc; text-align: left; padding: 6px 4px; vertical-align: top; }
      ${SCREEN_TABLE_CSS}
      .meta { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; }
      .total { font-size: 22px; font-weight: 700; }
      .sig { margin-top: 16px; }
      .sig img { height: 70px; border-bottom: 1px solid #111; }
      .note { font-size: 12px; color: #444; }
    </style></head><body>
      <header>
        <div>${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : `<h1>${escapeHtml(shopName || 'Shop')}</h1>`}<div class="note">${escapeHtml(shopName || 'Shop')} buying receipt</div></div>
        <div><h1>RECEIPT #${escapeHtml(purchase.purchaseNumber)}</h1><div>${escapeHtml(formatDisplayDate(purchase.date))}</div></div>
      </header>
      <p class="meta">
        Seller: <strong>${escapeHtml(purchase.boughtFrom || '')}</strong><br>
        ${purchase.sellerPhone ? `Phone: ${escapeHtml(purchase.sellerPhone)}<br>` : ''}
        ${purchase.sellerEmail ? `Email: ${escapeHtml(purchase.sellerEmail)}<br>` : ''}
        Buyer: ${escapeHtml(purchase.buyerName || '')}<br>
        Logged by: ${escapeHtml(purchase.loggedByName || purchase.buyerName || '')}<br>
        ID on file: ${purchase.idOnFile ? 'Yes' : 'No'}
        ${purchase.approvalStatus === 'pending' ? '<br><strong>Pending manager approval</strong>' : ''}
      </p>
      <ul>${payments}</ul>
      <p class="total">Total ${money(purchase.cost || 0)}</p>
      <p class="meta">Cards: ${escapeHtml(purchase.numCards || 0)}</p>
      ${items ? `<table><thead><tr><th>Item</th><th>Cert</th><th>Lookup</th><th>Check</th></tr></thead><tbody>${items}</tbody></table>` : ''}
      ${purchase.notes ? `<p class="note">Notes: ${escapeHtml(purchase.notes)}</p>` : ''}
      ${signatureUrl ? `<div class="sig"><div class="note">Seller signature</div><img src="${escapeHtml(signatureUrl)}" alt="Signature"></div>` : '<p class="note">No signature on this receipt.</p>'}
      <p class="note">Card photos and the seller ID stay in the shop's private records. This receipt does not include the ID image.</p>
    </body></html>`;
}

export function sellerReportHtml(seller, purchases, { shopName } = {}) {
  const rows = (purchases || []).map((purchase) => (
    `<tr><td data-label="Date">${escapeHtml(formatDisplayDate(purchase.date))}</td><td data-label="Slip">#${escapeHtml(purchase.purchaseNumber)}</td><td data-label="Cost">${money(purchase.cost)}</td><td data-label="Payout">${escapeHtml(paymentSummary(purchase))}</td><td data-label="Status">${escapeHtml(statusLabel(purchase.inventoryStatus))}</td><td data-label="Buyer">${escapeHtml(purchase.buyerName || '')}</td></tr>`
  )).join('');
  return `<!DOCTYPE html><html><head><title>${escapeHtml(seller.name || 'Seller')}</title>
    <style>body{font-family:Arial,sans-serif;margin:24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;text-align:left;padding:6px}${SCREEN_TABLE_CSS}</style>
    </head><body><h1>${escapeHtml(shopName || 'Shop')}</h1><h2>${escapeHtml(seller.name || '')}</h2>
    <p>${escapeHtml(seller.phone || '')} ${escapeHtml(seller.email || '')}</p>
    <table><thead><tr><th>Date</th><th>Slip</th><th>Cost</th><th>Payout</th><th>Status</th><th>Buyer</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
