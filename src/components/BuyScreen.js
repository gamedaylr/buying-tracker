import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from '../gameday-logo.png';
import { useAuth } from '../auth/AuthProvider';
import { parseAamva } from '../lib/aamva';
import {
  PAYMENT_METHODS,
  INVENTORY_STATUSES,
  approvalDecision,
  applyCompInput,
  applyCostInput,
  applyPercentInput,
  computeOffers,
  emptyForm,
  findSellers,
  form8300Status,
  idIsRequired,
  inferPayoutType,
  mailtoHref,
  money,
  num,
  priorCashForSeller,
  receiptText,
  smsHref,
  tenderGap,
  validateBuy,
} from '../lib/buying';
import { GRADERS, interpretScan, officialLookup } from '../lib/graders';
import { plainError } from '../lib/errors';
import { lookupCert } from '../services/api';
import { approveWithManagerLogin } from '../services/accounts';
import { savePurchase } from '../services/purchases';
import { absoluteAsset, closePrintWindow, copyText, preparePrintWindow, printHtml } from '../services/print';
import { receiptHtml, slipHtml } from '../lib/printHtml';
import PhotoPicker from './PhotoPicker';
import Scanner from './Scanner';
import SignaturePad from './SignaturePad';

function newLine() {
  const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `line-${Date.now()}`;
  return {
    id,
    description: '',
    quantity: 1,
    grader: '',
    certNumber: '',
    verificationStatus: 'unchecked',
    lookupDetails: null,
    photoFile: null,
    photoUrl: '',
    message: '',
  };
}

export default function BuyScreen({ onManage }) {
  const { firebaseUser, profile, settings, sellers, signOutShop } = useAuth();
  const [form, setForm] = useState(() => emptyForm(profile, settings));
  const [seller, setSeller] = useState(null);
  const [idFiles, setIdFiles] = useState([]);
  const [cardFiles, setCardFiles] = useState([]);
  const [paymentFiles, setPaymentFiles] = useState([]);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [showId, setShowId] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [printNote, setPrintNote] = useState('');
  const [tendersFollow, setTendersFollow] = useState(true);
  const savingRef = useRef(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [approving, setApproving] = useState(false);
  const [copied, setCopied] = useState(false);

  const offers = computeOffers(form.lotComp, settings);
  const payoutType = inferPayoutType(form);
  const decision = approvalDecision({
    cost: form.cost,
    lotComp: form.lotComp,
    payoutType,
    settings,
  });
  const needsId = idIsRequired({
    cost: form.cost,
    settings,
    sellerHasIdPhoto: Boolean(seller && seller.hasIdPhoto),
    newIdPhotoCount: idFiles.length,
  });
  const cashNow = num(form.cash) + num(form.cashFromSafe);
  const alert8300 = form8300Status(priorCashForSeller(seller, form.date), cashNow);
  const suggestions = useMemo(
    () => (seller ? [] : findSellers(sellers, form.boughtFrom || form.sellerPhone)),
    [seller, sellers, form.boughtFrom, form.sellerPhone],
  );

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function chooseOffer(type) {
    const amount = type === 'store_credit' ? offers.creditOffer : offers.cashOffer;
    const percent = type === 'store_credit' ? offers.creditPercent : offers.cashPercent;
    setTendersFollow(true);
    setForm((prev) => ({
      ...prev,
      payoutType: type,
      cost: String(amount),
      percentageBought: String(percent),
      cash: type === 'cash' ? String(amount) : '',
      cashFromSafe: '',
      cashApp: '',
      venmo: '',
      zelle: '',
      paypal: '',
      trade: '',
      storeCredit: type === 'store_credit' ? String(amount) : '',
    }));
  }

  function onComp(value) {
    setForm((prev) => applyCompInput(prev, value));
  }

  function onCost(value) {
    setForm((prev) => applyCostInput(prev, value, { tendersFollowCost: tendersFollow }));
  }

  function onPercent(value) {
    setForm((prev) => applyPercentInput(prev, value, { tendersFollowCost: tendersFollow }));
  }

  function onTender(key, value) {
    setTendersFollow(false);
    setField(key, value);
  }

  function selectSeller(next) {
    setSeller(next);
    setForm((prev) => ({
      ...prev,
      boughtFrom: next.name || '',
      sellerPhone: next.phone || '',
      sellerEmail: next.email || '',
    }));
  }

  function onScan(text) {
    if (scanner === 'license') {
      const parsed = parseAamva(text);
      if (!parsed || !parsed.fullName) {
        setError('That barcode was not readable as a driver license. Type the seller name and photograph the ID.');
      } else {
        setForm((prev) => ({ ...prev, boughtFrom: parsed.fullName }));
        setSeller(null);
        setIdentity({
          idNumber: parsed.idNumber,
          dob: parsed.dob,
          address: parsed.address,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
        });
        setShowId(true);
        setError('');
      }
    } else if (scanner && scanner.lineId) {
      const scan = interpretScan(text);
      setLineItems((items) => items.map((item) => (
        item.id === scanner.lineId
          ? { ...item, certNumber: scan.certNumber || item.certNumber, scannedUrl: scan.official ? scan.url : '' }
          : item
      )));
    }
    setScanner(null);
  }

  async function lookupLine(item) {
    const info = officialLookup(item.grader, item.certNumber);
    if (!info) {
      setLineItems((items) => items.map((row) => (row.id === item.id ? { ...row, message: 'Choose a grader.' } : row)));
      return;
    }
    if (info.mode !== 'api') {
      window.open(item.scannedUrl || info.url, '_blank', 'noopener,noreferrer');
      setLineItems((items) => items.map((row) => (
        row.id === item.id ? { ...row, message: info.hint || `Opened the official ${info.label}.`, linkUrl: info.url } : row
      )));
      return;
    }
    setLineItems((items) => items.map((row) => (row.id === item.id ? { ...row, message: 'Looking up PSA…' } : row)));
    try {
      const token = await firebaseUser.getIdToken();
      const response = await lookupCert(token, 'PSA', item.certNumber);
      setLineItems((items) => items.map((row) => {
        if (row.id !== item.id) return row;
        if (response.mode === 'details') {
          return { ...row, lookupDetails: response.details, verificationStatus: 'unchecked', message: 'Compare this with the slab, then tap Matches or Doesn\'t match.', linkUrl: response.url };
        }
        if (response.mode === 'not_found') {
          return { ...row, lookupDetails: null, verificationStatus: 'not_found', message: response.message, linkUrl: response.url };
        }
        return { ...row, message: response.message, linkUrl: response.url };
      }));
    } catch (err) {
      setLineItems((items) => items.map((row) => (
        row.id === item.id ? { ...row, message: `${err.message} You can still open PSA's site.`, linkUrl: info.url } : row
      )));
    }
  }

  function markLine(item, status) {
    setLineItems((items) => items.map((row) => (
      row.id === item.id
        ? { ...row, verificationStatus: status, verification: row.lookupDetails || row.verification || null }
        : row
    )));
  }

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current || result) return;
    const problem = validateBuy({
      form,
      settings,
      sellerHasIdPhoto: Boolean(seller && seller.hasIdPhoto),
      newIdPhotoCount: idFiles.length,
      lineItems,
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (!tenderGap(form).matches) {
      setError('Payment boxes have to add up to the cost paid.');
      return;
    }
    const printWindow = preparePrintWindow();
    savingRef.current = true;
    setSaving(true);
    setError('');
    setPrintNote('');
    try {
      const saved = await savePurchase({
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
      });
      setResult(saved);
      setIdentity(null);
      const printed = printHtml(
        slipHtml(saved.purchase, { shopName: settings.shopName, signatureUrl: signatureUrl() }),
        { preparedWindow: printWindow, autoPrint: true },
      );
      if (!printed) {
        closePrintWindow(printWindow);
        setPrintNote('The slip is saved. Tap Print slip to open the printer.');
      }
    } catch (err) {
      closePrintWindow(printWindow);
      setError(plainError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function signatureUrl() {
    if (!signatureBlob) return '';
    return URL.createObjectURL(signatureBlob);
  }

  function printSlip(purchase) {
    const opened = printHtml(slipHtml(purchase, { shopName: settings.shopName, signatureUrl: signatureUrl() }));
    if (!opened) setPrintNote('The browser blocked the print window. Allow pop-ups for this site, then tap Print slip again.');
  }

  function printReceipt(purchase) {
    const signatureUrlValue = signatureUrl();
    printHtml(receiptHtml(purchase, { logoUrl: absoluteAsset(logo), signatureUrl: signatureUrlValue, shopName: settings.shopName }));
  }

  async function approve() {
    if (!result) return;
    setApproving(true);
    setError('');
    try {
      const name = await approveWithManagerLogin({
        purchaseId: result.purchase.firebaseKey,
        email: managerEmail,
        password: managerPassword,
      });
      setResult({
        ...result,
        purchase: { ...result.purchase, approvalStatus: 'approved', approvedByName: name },
      });
      setManagerPassword('');
    } catch (err) {
      setError(plainError(err));
    } finally {
      setApproving(false);
    }
  }

  function reset() {
    setForm(emptyForm(profile, settings));
    setSeller(null);
    setIdFiles([]);
    setCardFiles([]);
    setPaymentFiles([]);
    setSignatureBlob(null);
    setLineItems([]);
    setIdentity(null);
    setResult(null);
    setError('');
    setPrintNote('');
    setTendersFollow(true);
    savingRef.current = false;
  }

  useEffect(() => {
    if (!result) return undefined;
    const node = document.querySelector('[data-testid="saved-buy"]');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'start' });
    return undefined;
  }, [result]);

  const gap = tenderGap(form);
  const locked = Boolean(result);
  const tenderName = form.payoutType === 'store_credit' ? 'Store credit' : 'Cash';

  return (
    <div className="app" data-testid="buy-screen">
      <header className="topbar">
        <img src={logo} alt="" className="logo" />
        <div>
          <strong>{settings.shopName}</strong>
          <span>{settings.tagline}</span>
        </div>
        <div className="top-actions">
          {onManage ? <a className="btn btn-ghost" href="#/manage">Manager desk</a> : null}
          <button type="button" className="btn btn-ghost" onClick={signOutShop}>Sign out</button>
        </div>
      </header>

      <main className="wrap">
        <p className="who">Logged in as {profile.name}. Buys are stamped with this login.</p>
        {result ? (
          <section className="card saved" data-testid="saved-buy">
            <h2>Saved slip #{result.purchase.purchaseNumber}</h2>
            {result.purchase.approvalStatus === 'pending' ? (
              <p className="banner warn">A manager still needs to approve this buy. It is saved as pending.</p>
            ) : null}
            {result.identityWarning ? <p className="banner warn">{result.identityWarning}</p> : null}
            {printNote ? <p className="banner warn">{printNote}</p> : null}
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => printSlip(result.purchase)}>Print slip</button>
              <button type="button" className="btn btn-ghost" onClick={() => printReceipt(result.purchase)}>Print / save PDF</button>
              <a className="btn btn-ghost" href={mailtoHref(result.purchase, settings)}>Email receipt</a>
              <a className="btn btn-ghost" href={smsHref(result.purchase, settings)}>Text receipt</a>
              <button type="button" className="btn btn-ghost" onClick={async () => {
                await copyText(receiptText(result.purchase, settings));
                setCopied(true);
              }}>{copied ? 'Copied' : 'Copy receipt'}</button>
            </div>
            {result.purchase.approvalStatus === 'pending' ? (
              <form className="stack" onSubmit={(event) => { event.preventDefault(); approve(); }}>
                <h3>Manager approval on this tablet</h3>
                <p className="hint">The manager types their own email and password. Staff stay signed in.</p>
                <label>Manager email
                  <input type="email" value={managerEmail} onChange={(event) => setManagerEmail(event.target.value)} required />
                </label>
                <label>Manager password
                  <input type="password" value={managerPassword} onChange={(event) => setManagerPassword(event.target.value)} required />
                </label>
                <button className="btn btn-primary" type="submit" disabled={approving}>{approving ? 'Checking…' : 'Approve this buy'}</button>
              </form>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={reset}>Log another buy</button>
          </section>
        ) : null}

        <form className="card stack" onSubmit={submit}>
          <fieldset className="buy-lock stack" disabled={saving || locked}>
          <h1>Log a buy</h1>
          <div className="grid-2">
            <label>Date
              <input type="date" value={form.date} onChange={(event) => setField('date', event.target.value)} required />
            </label>
            <label>Buyer name
              <input value={form.buyerName} onChange={(event) => setField('buyerName', event.target.value)} required />
            </label>
          </div>

          <fieldset className="stack">
            <legend>Seller</legend>
            <label>Seller name
              <input
                value={form.boughtFrom}
                onChange={(event) => {
                  setField('boughtFrom', event.target.value);
                  if (seller && event.target.value.trim().toLowerCase() !== String(seller.name || '').toLowerCase()) setSeller(null);
                }}
                placeholder="Start typing a name or phone"
                autoComplete="off"
              />
            </label>
            {suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((item) => (
                  <li key={item.firebaseKey || item.id}>
                    <button type="button" onClick={() => selectSeller(item)}>
                      {item.name} {item.phone ? `· ${item.phone}` : ''} {item.hasIdPhoto ? '· ID on file' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {seller && seller.hasIdPhoto ? <p className="banner ok">ID already on file for this seller. A new photo is optional.</p> : null}
            <div className="grid-2">
              <label>Phone
                <input value={form.sellerPhone} onChange={(event) => setField('sellerPhone', event.target.value)} inputMode="tel" />
              </label>
              <label>Email for the receipt
                <input type="email" value={form.sellerEmail} onChange={(event) => setField('sellerEmail', event.target.value)} />
              </label>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setScanner('license')}>Scan driver license barcode</button>
            {identity ? (
              <div className="stack">
                <p className="hint">Barcode read. The ID number is kept in memory until you save, then stored encrypted for managers only.</p>
                <label>ID number
                  <input type={showId ? 'text' : 'password'} value={identity.idNumber || ''} onChange={(event) => setIdentity({ ...identity, idNumber: event.target.value })} autoComplete="off" />
                </label>
                <button type="button" className="btn btn-text" onClick={() => setShowId((value) => !value)}>{showId ? 'Hide ID number' : 'Show ID number'}</button>
                <label>Date of birth
                  <input type="date" value={identity.dob || ''} onChange={(event) => setIdentity({ ...identity, dob: event.target.value })} />
                </label>
              </div>
            ) : null}
            <PhotoPicker
              label="Seller ID photo"
              hint={needsId ? `Required at ${money(settings.idThreshold)} and above. Managers are the only people who can open it later.` : 'Managers are the only people who can open ID photos later.'}
              files={idFiles}
              onChange={setIdFiles}
              limit={2}
            />
          </fieldset>

          <fieldset className="stack">
            <legend>Offer</legend>
            <label>Lot comp
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.lotComp} onChange={(event) => onComp(event.target.value)} />
            </label>
            <div className="offer-row">
              <button type="button" className={form.payoutType === 'cash' ? 'offer selected' : 'offer'} onClick={() => chooseOffer('cash')}>
                <span>Cash</span>
                <strong>{money(offers.cashOffer)}</strong>
                <small>{offers.cashPercent}% of comp</small>
              </button>
              <button type="button" className={form.payoutType === 'store_credit' ? 'offer selected' : 'offer'} onClick={() => chooseOffer('store_credit')}>
                <span>Store credit</span>
                <strong>{money(offers.creditOffer)}</strong>
                <small>{offers.creditPercent}% of comp</small>
              </button>
            </div>
            <div className="grid-2">
              <label>Percent of comp
                <input type="number" min="0" step="0.1" inputMode="decimal" value={form.percentageBought} onChange={(event) => onPercent(event.target.value)} />
              </label>
              <label>Cost paid
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost} onChange={(event) => onCost(event.target.value)} required />
              </label>
            </div>
            <p className="hint">Percent of comp updates from the cost paid divided by the comp.</p>
            {decision.needed ? (
              <p className="banner warn">{decision.reasons.join(' ')} You can save it, and a manager approves it here or from the manager desk.</p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>How it was paid</legend>
            <div className="pay-grid">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.key}>{method.label}
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={form[method.key]} onChange={(event) => onTender(method.key, event.target.value)} />
                </label>
              ))}
            </div>
            {!gap.matches ? (
              <p className="banner warn" role="alert">
                Payment boxes add up to {money(gap.paid)}. Cost paid is {money(gap.cost)}. Change the boxes so they match the cost.
              </p>
            ) : tendersFollow ? (
              <p className="hint">{tenderName} is filled in from the cost paid. Change the boxes only if you split the payment.</p>
            ) : (
              <p className="hint">Payment boxes match the cost paid.</p>
            )}
          </fieldset>

          {alert8300.over ? (
            <p className="banner danger">
              Cash for this seller today would be {money(alert8300.total)}. That is over $10,000. Tell a manager before paying.
              This reminder is about IRS Form 8300 and is not tax advice. Venmo, Cash App, Zelle, PayPal, trade, and store credit are not in this cash total.
            </p>
          ) : null}

          <div className="grid-2">
            <label>Number of cards
              <input type="number" min="0" step="1" value={form.numCards} onChange={(event) => setField('numCards', event.target.value)} />
            </label>
            <label>What happens to the cards next
              <select value={form.inventoryStatus} onChange={(event) => setField('inventoryStatus', event.target.value)}>
                {INVENTORY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
          </div>
          <label>Hold period in days
            <input type="number" min="0" max="365" value={form.holdDays} onChange={(event) => setField('holdDays', event.target.value)} placeholder={settings.holdDays ? String(settings.holdDays) : '0 means no hold'} />
          </label>
          <label>Notes
            <textarea rows="2" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Anything you would search later" />
          </label>

          <fieldset className="stack">
            <legend>Graded slabs</legend>
            <p className="hint">Optional. PSA details come from PSA's official API. Other graders open their own lookup page.</p>
            {lineItems.map((item) => (
              <div className="line-item" key={item.id}>
                <div className="grid-2">
                  <label>Description
                    <input value={item.description} onChange={(event) => setLineItems((rows) => rows.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} />
                  </label>
                  <label>Qty
                    <input type="number" min="1" value={item.quantity} onChange={(event) => setLineItems((rows) => rows.map((row) => row.id === item.id ? { ...row, quantity: event.target.value } : row))} />
                  </label>
                </div>
                <div className="grid-2">
                  <label>Grader
                    <select value={item.grader} onChange={(event) => setLineItems((rows) => rows.map((row) => row.id === item.id ? { ...row, grader: event.target.value } : row))}>
                      <option value="">None</option>
                      {GRADERS.map((grader) => <option key={grader.id} value={grader.id}>{grader.label}</option>)}
                    </select>
                  </label>
                  <label>Cert number
                    <input value={item.certNumber} onChange={(event) => setLineItems((rows) => rows.map((row) => row.id === item.id ? { ...row, certNumber: event.target.value } : row))} />
                  </label>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setScanner({ lineId: item.id })}>Scan slab code</button>
                  <button type="button" className="btn btn-ghost" onClick={() => lookupLine(item)}>Look up cert</button>
                  <label className="btn btn-ghost">Card photo
                    <input type="file" accept="image/*" capture="environment" onChange={(event) => {
                      const file = event.target.files && event.target.files[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      setLineItems((rows) => rows.map((row) => row.id === item.id ? { ...row, photoFile: file, photoUrl: url } : row));
                    }} />
                  </label>
                  <button type="button" className="btn btn-text" onClick={() => setLineItems((rows) => rows.filter((row) => row.id !== item.id))}>Remove slab</button>
                </div>
                {item.photoUrl ? <img className="thumb-inline" src={item.photoUrl} alt="" /> : null}
                {item.lookupDetails ? (
                  <div className="cert-result">
                    <p><strong>{item.lookupDetails.player}</strong></p>
                    <p>{[item.lookupDetails.year, item.lookupDetails.setName, item.lookupDetails.cardNumber && `#${item.lookupDetails.cardNumber}`, item.lookupDetails.grade].filter(Boolean).join(' · ')}</p>
                    <div className="row-actions">
                      <button type="button" className="btn btn-primary" onClick={() => markLine(item, 'verified')}>Matches</button>
                      <button type="button" className="btn btn-ghost" onClick={() => markLine(item, 'mismatch')}>Doesn't match</button>
                    </div>
                  </div>
                ) : null}
                {item.message ? <p className="hint">{item.message}</p> : null}
                {item.linkUrl ? <a href={item.linkUrl} target="_blank" rel="noreferrer">Open the official lookup</a> : null}
                {item.verificationStatus === 'verified' ? <p className="banner ok">Marked as a match.</p> : null}
                {item.verificationStatus === 'mismatch' ? <p className="banner warn">Marked as a mismatch. A manager will see it.</p> : null}
                {item.verificationStatus === 'not_found' ? <p className="banner warn">PSA has no record for that number.</p> : null}
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => setLineItems((rows) => [...rows, newLine()])}>Add a slab</button>
          </fieldset>

          <PhotoPicker label="Photos of the cards" hint="Take a few. Later, tags can be added to each photo." files={cardFiles} onChange={setCardFiles} multiple limit={12} />
          <PhotoPicker label="Payment proof" hint="A screenshot of Cash App, Zelle, Venmo, or PayPal." files={paymentFiles} onChange={setPaymentFiles} multiple limit={4} />
          <fieldset>
            <legend>Seller signature</legend>
            <SignaturePad onChange={setSignatureBlob} />
          </fieldset>

          {error ? <p className="banner warn">{error}</p> : null}
          {!gap.matches ? (
            <p className="banner warn" role="alert">
              Payment boxes add up to {money(gap.paid)}. Cost paid is {money(gap.cost)}. They need to match before you save.
            </p>
          ) : null}
          <button className="btn btn-primary btn-save" type="submit" disabled={saving || locked || !gap.matches}>
            {saving ? 'Saving…' : locked ? 'Saved' : 'Save and print slip'}
          </button>
          </fieldset>
        </form>
      </main>
      {scanner ? (
        <Scanner
          title={scanner === 'license' ? 'Scan the ID barcode' : 'Scan the slab'}
          mode={scanner === 'license' ? 'license' : 'code'}
          onResult={onScan}
          onClose={() => setScanner(null)}
        />
      ) : null}
    </div>
  );
}
