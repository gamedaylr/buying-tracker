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
export function printableDocument(html, { autoPrint = false } = {}) {
  const script = autoPrint
    ? '<script>window.addEventListener("load",function(){try{window.focus();window.print();}catch(e){}});window.addEventListener("afterprint",function(){window.close();});</script>'
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

export function slipHtml(purchase, { logoUrl, shopName } = {}) {
  const date = formatDisplayDate(purchase.date);
  const lines = paymentLines(purchase).map((line) => (
    `<div class="row"><span>${escapeHtml(line.label)}</span><span>${money(line.amount)}</span></div>`
  )).join('');
  const pending = purchase.approvalStatus === 'pending'
    ? '<div class="flag">PENDING APPROVAL</div>'
    : '';
  const offer = purchase.payoutType === 'store_credit' ? 'STORE CREDIT' : 'CASH';
  return `<!DOCTYPE html><html><head><title>Slip #${escapeHtml(purchase.purchaseNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .slip { width: 100%; max-width: 4in; min-height: 6in; padding: 0.18in; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      img { height: 36px; }
      .muted { color: #444; font-size: 11px; }
      .row, .field { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin: 3px 0; }
      .cost { margin-top: 8px; border-top: 2px solid #111; padding-top: 6px; font-size: 18px; font-weight: 700; }
      .flag { margin-top: 8px; border: 2px solid #111; text-align: center; font-weight: 700; padding: 4px; }
    </style></head><body><div class="slip">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : `<h1>${escapeHtml(shopName || 'Shop')}</h1>`}
      <h1>SLIP #${escapeHtml(purchase.purchaseNumber)}</h1>
      <div class="field"><span>Date</span><span>${escapeHtml(date)}</span></div>
      <div class="field"><span>Seller</span><span>${escapeHtml(purchase.boughtFrom || '')}</span></div>
      <div class="field"><span>Buyer</span><span>${escapeHtml(purchase.buyerName || '')}</span></div>
      <div class="field"><span>Took</span><span>${offer}</span></div>
      <div class="field"><span>Comp</span><span>${money(purchase.lotComp || 0)}</span></div>
      ${lines}
      <div class="field"><span>%</span><span>${Number(purchase.percentageBought || 0).toFixed(2)}</span></div>
      <div class="field"><span>Cards</span><span>${escapeHtml(purchase.numCards || 0)}</span></div>
      <div class="cost">COST ${money(purchase.cost || 0)}</div>
      ${pending}
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
        ${purchase.holdUntil ? `<br>Do not sell until ${escapeHtml(formatDisplayDate(purchase.holdUntil))}` : ''}
        ${purchase.approvalStatus === 'pending' ? '<br><strong>Pending manager approval</strong>' : ''}
      </p>
      <p class="meta">Comp ${money(purchase.lotComp || 0)}.
        Cash offer ${money(purchase.cashOffer || 0)} (${escapeHtml(purchase.cashOfferPercent || '')}%).
        Store credit offer ${money(purchase.creditOffer || 0)} (${escapeHtml(purchase.creditOfferPercent || '')}%).
        Seller took <strong>${purchase.payoutType === 'store_credit' ? 'store credit' : 'cash'}</strong>.
      </p>
      <ul>${payments}</ul>
      <p class="total">Total ${money(purchase.cost || 0)}</p>
      <p class="meta">Cards: ${escapeHtml(purchase.numCards || 0)} · Status: ${escapeHtml(statusLabel(purchase.inventoryStatus))}</p>
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
