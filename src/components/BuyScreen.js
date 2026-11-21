import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from '../gameday-logo.png';
import { useAuth } from '../auth/AuthProvider';
import { parseAamva } from '../lib/aamva';
import {
  PAYMENT_METHODS,
  approvalDecision,
  applyCompInput,
  applyCostInput,
  applyPercentInput,
  cardsOnBuy,
  computeOffers,
  emptyForm,
  findSellers,
  formatPercent,
  form8300Status,
  idIsRequired,
  inferPayoutType,
  mailtoHref,
  money,
  num,
  normalizeTypedPercent,
  paymentLines,
  percentText,
  priorCashForSeller,
  receiptContactError,
  receiptText,
  roundMoney,
  smsHref,
  tenderGap,
  validateBuy,
} from '../lib/buying';
import { GRADERS, interpretScan, officialLookup } from '../lib/graders';
import { plainError } from '../lib/errors';
import { lookupCert } from '../services/api';
import { approveWithManagerLogin } from '../services/accounts';
import { savePurchase } from '../services/purchases';
import { absoluteAsset, closePrintWindow, copyText, preparePrintWindow, printHtml, watchLabelPrint } from '../services/print';
import { receiptHtml, slipHtml } from '../lib/printHtml';
import PhotoPicker from './PhotoPicker';
import Scanner from './Scanner';
import SignaturePad from './SignaturePad';

function SellerSign({
  shopName, amount, tenders, cards, photos, signed, onSign, onDone, onBack,
  receiptChoice, onReceiptChoice, receiptPhone, onReceiptPhone, receiptEmail, onReceiptEmail, contactError,
}) {
  const cardLabel = cards === 1 ? '1 card' : `${cards} cards`;
  return (
    <main className="seller-screen" data-testid="seller-sign">
      <h1 className="seller-shop">{shopName}</h1>
      <p className="seller-k">We're paying you</p>
      <p className="seller-pay">{money(amount)}</p>
      {tenders.length > 0 ? (
        <ul className="seller-tenders">
          {tenders.map((line) => (
            <li key={line.key}><span>{line.label}</span><span>{money(line.amount)}</span></li>
          ))}
        </ul>
      ) : null}
      <p className="seller-cards">{cardLabel}</p>
      {photos.length > 0 ? (
        <div className="thumbs seller-thumbs">
          {photos.map((src) => <img key={src} src={src} alt="" />)}
        </div>
      ) : null}
      <p className="seller-agree">I agree to sell these cards to {shopName} for the amount above.</p>
      <fieldset className="seller-receipt">
        <legend>Want a receipt?</legend>
        {[
          ['none', 'No receipt'],
          ['text', 'Text it to me'],
          ['email', 'Email it to me'],
        ].map(([value, label]) => (
          <label className="check" key={value}>
            <input
              type="radio"
              name="receipt"
              checked={receiptChoice === value}
              onChange={() => onReceiptChoice(value)}
            />
            {label}
          </label>
        ))}
        {receiptChoice === 'text' ? (
          <label>Phone for the text
            <input inputMode="tel" autoComplete="tel" value={receiptPhone} onChange={(event) => onReceiptPhone(event.target.value)} />
          </label>
        ) : null}
        {receiptChoice === 'email' ? (
          <label>Email for the receipt
            <input type="email" autoComplete="email" value={receiptEmail} onChange={(event) => onReceiptEmail(event.target.value)} />
          </label>
        ) : null}
        {contactError ? <p className="banner warn">{contactError}</p> : null}
      </fieldset>
      <SignaturePad tall onChange={onSign} />
      <div className="seller-actions">
        <button type="button" className="btn btn-primary btn-save" disabled={!signed} onClick={onDone}>Done</button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>
    </main>
  );
}

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
  const [step, setStep] = useState('staff');
  const signedKey = useRef('');
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
  const labelWatch = useRef(() => {});
  const pendingReceipt = useRef(null);
  const [labelStatus, setLabelStatus] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [approving, setApproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptChoice, setReceiptChoice] = useState('none');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [contactError, setContactError] = useState('');

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
  function dealSnapshot(nextForm) {
    return JSON.stringify({
      form: nextForm,
      sellerId: seller && (seller.id || seller.firebaseKey || seller.name),
      identity: identity ? { idNumber: identity.idNumber, dob: identity.dob, address: identity.address } : null,
      lines: lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        grader: item.grader,
        certNumber: item.certNumber,
        photoUrl: item.photoUrl,
        verificationStatus: item.verificationStatus,
      })),
      cards: cardFiles.map((file) => file.id),
      ids: idFiles.map((file) => file.id),
      payments: paymentFiles.map((file) => file.id),
    });
  }
  const dealKey = useMemo(
    () => dealSnapshot(form),
    // dealSnapshot closes over the same values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, seller, identity, lineItems, cardFiles, idFiles, paymentFiles],
  );

  useEffect(() => {
    if (!signedKey.current || signedKey.current === dealKey) return;
    signedKey.current = '';
    setSignatureBlob(null);
  }, [dealKey]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function chooseOffer(type) {
    const amount = type === 'store_credit' ? offers.creditOffer : offers.cashOffer;
    const percent = type === 'store_credit' ? offers.creditPercent : offers.cashPercent;
    const cost = String(roundMoney(amount));
    setTendersFollow(true);
    setForm((prev) => ({
      ...prev,
      payoutType: type,
      cost,
      percentageBought: prev.lotComp !== '' && prev.lotComp != null
        ? percentText(cost, prev.lotComp)
        : formatPercent(percent),
      cash: type === 'cash' ? cost : '',
      cashFromSafe: '',
      cashApp: '',
      venmo: '',
      zelle: '',
      paypal: '',
      trade: '',
      storeCredit: type === 'store_credit' ? cost : '',
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

  function onPercentBlur() {
    setForm((prev) => normalizeTypedPercent(prev));
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
    if (!signatureBlob) {
      goToSign();
      return;
    }
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
        receiptRequested: receiptChoice,
      });
      setResult(saved);
      setIdentity(null);
      pendingReceipt.current = saved.purchase.receiptRequested === 'text' || saved.purchase.receiptRequested === 'email'
        ? saved.purchase
        : null;
      startLabelPrint(saved.purchase, { preparedWindow: printWindow, autoPrint: true });
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

  function startLabelPrint(purchase, { preparedWindow, autoPrint }) {
    labelWatch.current();
    const win = printHtml(
      slipHtml(purchase, { shopName: settings.shopName, signatureUrl: signatureUrl() }),
      { preparedWindow, autoPrint, trackLabel: true },
    );
    if (!win) {
      closePrintWindow(preparedWindow);
      setLabelStatus('blocked');
      return;
    }
    setLabelStatus('dialog');
    labelWatch.current = watchLabelPrint(win, setLabelStatus);
  }

  function printSlip(purchase) {
    const preparedWindow = preparePrintWindow();
    startLabelPrint(purchase, { preparedWindow, autoPrint: false });
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
    setStep('staff');
    setReceiptChoice('none');
    setReceiptPhone('');
    setReceiptEmail('');
    setContactError('');
    signedKey.current = '';
    savingRef.current = false;
  }

  function goToSign() {
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
    setError('');
    setContactError('');
    setReceiptPhone(form.sellerPhone || '');
    setReceiptEmail(form.sellerEmail || '');
    setSignatureBlob(null);
    signedKey.current = '';
    setStep('sign');
  }

  function backFromSign() {
    setSignatureBlob(null);
    signedKey.current = '';
    setStep('staff');
  }

  function finishSign() {
    if (!signatureBlob) return;
    const problem = receiptContactError(receiptChoice, receiptPhone, receiptEmail);
    if (problem) {
      setContactError(problem);
      return;
    }
    setContactError('');
    const nextForm = receiptChoice === 'text'
      ? { ...form, sellerPhone: receiptPhone.trim() }
      : receiptChoice === 'email'
        ? { ...form, sellerEmail: receiptEmail.trim() }
        : form;
    signedKey.current = dealSnapshot(nextForm);
    if (nextForm !== form) setForm(nextForm);
    setStep('staff');
  }

  useEffect(() => {
    if (!result) return undefined;
    const node = document.querySelector('[data-testid="saved-buy"]');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'start' });
    return undefined;
  }, [result]);

  useEffect(() => {
    if (labelStatus !== 'check' || !pendingReceipt.current) return undefined;
    const purchase = pendingReceipt.current;
    pendingReceipt.current = null;
    const href = purchase.receiptRequested === 'email'
      ? mailtoHref(purchase, settings)
      : purchase.receiptRequested === 'text'
        ? smsHref(purchase, settings)
        : '';
    if (!href) return undefined;
    const link = document.createElement('a');
    link.href = href;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return undefined;
  }, [labelStatus, settings]);

  const gap = tenderGap(form);
  const locked = Boolean(result);
  const tenderName = form.payoutType === 'store_credit' ? 'Store credit' : 'Cash';
  const cardPhotos = [
    ...cardFiles.map((file) => file.url),
    ...lineItems.map((item) => item.photoUrl).filter(Boolean),
  ];

  if (step === 'sign') {
    return (
      <SellerSign
        shopName={settings.shopName}
        amount={num(form.cost)}
        tenders={paymentLines(form)}
        cards={cardsOnBuy(form, lineItems, cardFiles.length)}
        photos={cardPhotos}
        signed={Boolean(signatureBlob)}
        onSign={setSignatureBlob}
        onDone={finishSign}
        onBack={backFromSign}
        receiptChoice={receiptChoice}
        onReceiptChoice={(value) => { setContactError(''); setReceiptChoice(value); }}
        receiptPhone={receiptPhone}
        onReceiptPhone={(value) => { setContactError(''); setReceiptPhone(value); }}
        receiptEmail={receiptEmail}
        onReceiptEmail={(value) => { setContactError(''); setReceiptEmail(value); }}
        contactError={contactError}
      />
    );
  }

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
            {labelStatus === 'dialog' ? <p className="banner ok">Printing the card label. It goes with the cards.</p> : null}
            {labelStatus === 'blocked' ? <p className="banner warn">The label did not print. Pop-up windows are blocked. Tap Reprint label. It goes with the cards.</p> : null}
            {labelStatus === 'cancelled' ? <p className="banner warn">The label was not printed. Tap Reprint label before you put the cards away.</p> : null}
            {labelStatus === 'check' ? <p className="banner warn">If you cancelled the label, or nothing came out, tap Reprint label. It goes with the cards.</p> : null}
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => printSlip(result.purchase)}>Reprint label</button>
              <button type="button" className="btn btn-ghost" onClick={() => printReceipt(result.purchase)}>Print / save PDF</button>
              {result.purchase.receiptRequested === 'email' ? (
                <a className="btn btn-ghost" href={mailtoHref(result.purchase, settings)}>Email receipt</a>
              ) : null}
              {result.purchase.receiptRequested === 'text' ? (
                <a className="btn btn-ghost" href={smsHref(result.purchase, settings)}>Text receipt</a>
              ) : null}
              {result.purchase.receiptRequested === 'none' ? <span className="hint">No receipt requested.</span> : null}
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
                <small>{formatPercent(offers.cashPercent)}% of comp</small>
              </button>
              <button type="button" className={form.payoutType === 'store_credit' ? 'offer selected' : 'offer'} onClick={() => chooseOffer('store_credit')}>
                <span>Store credit</span>
                <strong>{money(offers.creditOffer)}</strong>
                <small>{formatPercent(offers.creditPercent)}% of comp</small>
              </button>
            </div>
            <div className="grid-2">
              <label>Percent of comp
                <input inputMode="decimal" value={form.percentageBought} onChange={(event) => onPercent(event.target.value)} onBlur={onPercentBlur} />
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

          <label>Number of cards
            <input type="number" min="0" step="1" value={form.numCards} onChange={(event) => setField('numCards', event.target.value)} />
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

          {signatureBlob && !locked ? (
            <p className="banner ok">
              Seller signed.
              {receiptChoice === 'text' ? ' They asked for a text receipt.' : ''}
              {receiptChoice === 'email' ? ' They asked for an email receipt.' : ''}
              {receiptChoice === 'none' ? ' No receipt.' : ''}
              {' '}Change the buy and they will need to sign again.
            </p>
          ) : null}
          {error ? <p className="banner warn">{error}</p> : null}
          {!gap.matches ? (
            <p className="banner warn" role="alert">
              Payment boxes add up to {money(gap.paid)}. Cost paid is {money(gap.cost)}. They need to match before you continue.
            </p>
          ) : null}
          <button
            className="btn btn-primary btn-save"
            type={signatureBlob || locked ? 'submit' : 'button'}
            onClick={signatureBlob || locked ? undefined : goToSign}
            disabled={saving || locked || !gap.matches}
          >
            {saving ? 'Saving…' : locked ? 'Saved' : signatureBlob ? 'Save and print label' : 'Next: seller signs'}
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
