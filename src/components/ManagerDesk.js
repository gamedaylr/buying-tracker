import React, { useEffect, useMemo, useState } from 'react';
import { get, onValue, ref, update } from 'firebase/database';
import logo from '../gameday-logo.png';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthProvider';
import {
  INVENTORY_STATUSES,
  PAYMENT_METHODS,
  agreedPercent,
  cashAlerts,
  complianceRows,
  complianceToCsv,
  formFromPurchase,
  formatPercent,
  normalizeSettings,
  formatDisplayDate,
  knownLocations,
  lineItemsOf,
  locationName,
  matchesSearch,
  money,
  num,
  receiptChoiceLabel,
  paymentSummary,
  purchaseInRange,
  purchasesForTender,
  purchasesToCsv,
  sellerHistory,
  sortPurchasesNewestFirst,
  startOfMonthISO,
  startOfWeekISO,
  statusLabel,
  sumPurchases,
  tenderBreakdown,
  todayISO,
} from '../lib/buying';
import { plainError } from '../lib/errors';
import { receiptHtml, sellerReportHtml, slipHtml } from '../lib/printHtml';
import { createShopUser, setUserDisabled } from '../services/accounts';
import { decryptIdentity } from '../services/api';
import { downloadUrl } from '../services/photos';
import { absoluteAsset, closePrintWindow, downloadText, preparePrintWindow, printHtml } from '../services/print';
import { rowsFromSnapshot, saveManagerEdit, setPurchaseDeleted } from '../services/purchases';

const TABS = [
  ['buys', 'Buys'],
  ['summary', 'Summary'],
  ['sellers', 'Sellers'],
  ['people', 'People'],
  ['settings', 'Settings'],
  ['activity', 'Activity'],
  ['compliance', 'Compliance'],
];

function useCollection(path) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => onValue(ref(db, path), (snapshot) => {
    setRows(rowsFromSnapshot(snapshot));
    setError('');
  }, (err) => setError(plainError(err))), [path]);
  return { rows, error };
}

function PhotoStrip({ photos, label, reveal }) {
  const [open, setOpen] = useState(!reveal);
  const list = Array.isArray(photos) ? photos : Object.entries(photos || {}).map(([id, photo]) => ({ id, ...photo }));
  if (!list.length) return null;
  return (
    <div>
      <h3>{label}</h3>
      {reveal && !open ? <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Show {label.toLowerCase()}</button> : (
        <div className="thumbs">
          {list.map((photo) => <StoredImage key={photo.storagePath || photo.id} path={photo.storagePath} />)}
        </div>
      )}
    </div>
  );
}

function StoredImage({ path }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    downloadUrl(path).then((next) => { if (live) setUrl(next); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [path]);
  if (failed) return <p className="hint">This photo is unavailable.</p>;
  if (!url) return <p className="hint">Loading photo…</p>;
  return <a href={url} target="_blank" rel="noreferrer"><img className="thumb-inline" src={url} alt="" /></a>;
}

function PurchaseEditor({ purchase, onClose, profile, settings }) {
  const [form, setForm] = useState(() => formFromPurchase(purchase));
  const [items, setItems] = useState(() => lineItemsOf(purchase));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveManagerEdit(purchase, form, items, profile, settings);
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <div className="grid-2">
        <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label>Seller<input value={form.boughtFrom} onChange={(event) => setForm({ ...form, boughtFrom: event.target.value })} /></label>
        <label>Buyer<input value={form.buyerName} onChange={(event) => setForm({ ...form, buyerName: event.target.value })} /></label>
        <label>Location<input value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label>Cost<input type="number" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label>
      </div>
      <div className="pay-grid">
        {PAYMENT_METHODS.map((method) => (
          <label key={method.key}>{method.label}
            <input type="number" step="0.01" value={form[method.key]} onChange={(event) => setForm({ ...form, [method.key]: event.target.value })} />
          </label>
        ))}
      </div>
      <label>Status
        <select value={form.inventoryStatus} onChange={(event) => setForm({ ...form, inventoryStatus: event.target.value })}>
          {INVENTORY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </label>
      <label>Hold days<input type="number" min="0" value={form.holdDays} onChange={(event) => setForm({ ...form, holdDays: event.target.value })} /></label>
      <label>Notes<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      {items.map((item) => (
        <div className="grid-2" key={item.id}>
          <label>Slab<input value={item.description || ''} onChange={(event) => setItems(items.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} /></label>
          <label>Cert<input value={item.certNumber || ''} onChange={(event) => setItems(items.map((row) => row.id === item.id ? { ...row, certNumber: event.target.value } : row))} /></label>
        </div>
      ))}
      {error ? <p className="banner warn">{error}</p> : null}
      <div className="row-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function useDeskTab() {
  const [hash, setHash] = useState(window.location.hash || '#/manage/buys');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/manage/buys');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash.split('/')[2] || 'buys';
}

export default function ManagerDesk() {
  const { firebaseUser, profile, settings, signOutShop } = useAuth();
  const tab = useDeskTab();
  const purchases = useCollection('purchases');
  const users = useCollection('users');
  const activity = useCollection('audit');
  const sellers = useCollection('sellers');
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', seller: '', buyer: '', amount: '', paymentMethod: 'any', location: 'any', text: '', status: 'any', pendingOnly: false, includeDeleted: false,
  });
  const [visible, setVisible] = useState(40);
  const [openId, setOpenId] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => sortPurchasesNewestFirst(purchases.rows.filter((purchase) => matchesSearch(purchase, filters))),
    [purchases.rows, filters],
  );
  useEffect(() => {
    setVisible(40);
  }, [filters]);
  const open = purchases.rows.find((purchase) => purchase.firebaseKey === openId);

  async function printSlip(purchase) {
    const preparedWindow = preparePrintWindow();
    let signatureUrl = '';
    const path = purchase.photos && purchase.photos.signature && purchase.photos.signature.storagePath;
    if (path) signatureUrl = await downloadUrl(path).catch(() => '');
    const opened = printHtml(slipHtml(purchase, { shopName: settings.shopName, signatureUrl }), { preparedWindow });
    if (!opened) closePrintWindow(preparedWindow);
  }
  async function printReceipt(purchase) {
    let signatureUrl = '';
    const path = purchase.photos && purchase.photos.signature && purchase.photos.signature.storagePath;
    if (path) signatureUrl = await downloadUrl(path).catch(() => '');
    printHtml(receiptHtml(purchase, { logoUrl: absoluteAsset(logo), signatureUrl, shopName: settings.shopName }));
  }

  return (
    <div className="app" data-testid="manager-desk">
      <header className="topbar">
        <img src={logo} alt="" className="logo" />
        <div>
          <strong>{settings.shopName}</strong>
          <span>Manager desk</span>
        </div>
        <div className="top-actions">
          <a className="btn btn-ghost" href="#/buy">Buying desk</a>
          <button type="button" className="btn btn-ghost" onClick={signOutShop}>Sign out</button>
        </div>
      </header>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <a key={id} className={tab === id ? 'tab active' : 'tab'} href={`#/manage/${id}`}>{label}</a>
        ))}
      </nav>
      <main className="wrap">
        {error || purchases.error ? <p className="banner warn">{error || purchases.error}</p> : null}
        {tab === 'summary' && <SummaryPanel purchases={purchases.rows} locations={knownLocations(purchases.rows)} />}
        {tab === 'sellers' && (
          <SellersPanel
            sellers={sellers.rows}
            purchases={purchases.rows}
            settings={settings}
            firebaseUser={firebaseUser}
          />
        )}
        {tab === 'people' && <PeoplePanel users={users.rows} profile={profile} settings={settings} />}
        {tab === 'settings' && <SettingsPanel settings={settings} />}
        {tab === 'activity' && <ActivityPanel rows={activity.rows} />}
        {tab === 'compliance' && (
          <CompliancePanel purchases={purchases.rows} firebaseUser={firebaseUser} settings={settings} />
        )}
        {tab === 'buys' && (
          <section className="stack">
            <div className="card filters">
              <div className="grid-2">
                <label>From<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
                <label>To<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
                <label>Seller<input value={filters.seller} onChange={(event) => setFilters({ ...filters, seller: event.target.value })} /></label>
                <label>Buyer or staff<input value={filters.buyer} onChange={(event) => setFilters({ ...filters, buyer: event.target.value })} /></label>
                <label>Amount<input value={filters.amount} onChange={(event) => setFilters({ ...filters, amount: event.target.value })} inputMode="decimal" /></label>
                <label>Location
                  <select value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })}>
                    <option value="any">Any location</option>
                    {knownLocations(purchases.rows).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label>Payment
                  <select value={filters.paymentMethod} onChange={(event) => setFilters({ ...filters, paymentMethod: event.target.value })}>
                    <option value="any">Any</option>
                    {PAYMENT_METHODS.map((method) => <option key={method.key} value={method.key}>{method.label}</option>)}
                  </select>
                </label>
              </div>
              <label>Search text
                <input value={filters.text} onChange={(event) => setFilters({ ...filters, text: event.target.value })} placeholder="Cert, notes, phone, location" />
              </label>
              <div className="row-actions">
                <label className="check"><input type="checkbox" checked={filters.pendingOnly} onChange={(event) => setFilters({ ...filters, pendingOnly: event.target.checked })} /> Needs a manager</label>
                <label className="check"><input type="checkbox" checked={filters.includeDeleted} onChange={(event) => setFilters({ ...filters, includeDeleted: event.target.checked })} /> Show removed</label>
                <button type="button" className="btn btn-ghost" onClick={() => setFilters({ ...filters, dateFrom: todayISO(), dateTo: todayISO() })}>Today</button>
                <button type="button" className="btn btn-ghost" onClick={() => downloadText(`${settings.shopShortName}-buys-${todayISO()}.csv`, purchasesToCsv(filtered))}>Download these buys</button>
              </div>
              <label>Status
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <option value="any">Any</option>
                  <option value="untracked">Not tracked</option>
                  {INVENTORY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
            </div>
              <p className="hint">{filtered.length} buys, newest first</p>
            {filtered.slice(0, visible).map((purchase) => (
              <article className="card tx" key={purchase.firebaseKey} data-testid="buy-row" data-slip={purchase.purchaseNumber}>
                <button type="button" className="tx-main" onClick={() => { setOpenId(purchase.firebaseKey === openId ? '' : purchase.firebaseKey); setEditing(false); }}>
                  <strong>#{purchase.purchaseNumber} · {formatDisplayDate(purchase.date)}</strong>
                  <span>{purchase.boughtFrom || 'No seller'} · {money(purchase.cost)} · {locationName(purchase.location)}</span>
                  <span className="hint">{purchase.buyerName}{purchase.loggedByName ? ` · logged by ${purchase.loggedByName}` : ' · logged before sign-in'}</span>
                  {purchase.approvalStatus === 'pending' ? <em>Pending approval</em> : null}
                  {purchase.needsReview ? <em>Needs review</em> : null}
                  {purchase.deleted ? <em>Removed</em> : null}
                </button>
                {openId === purchase.firebaseKey && open ? (
                  <div className="stack">
                    <p>{purchase.payoutType === 'store_credit' ? 'Took store credit' : 'Took cash'} · {statusLabel(purchase.inventoryStatus)}{purchase.holdUntil ? ` · do not sell until ${formatDisplayDate(purchase.holdUntil)}` : ''}</p>
                    {num(purchase.lotComp) > 0 ? <p>Comp {money(purchase.lotComp)} · {formatPercent(agreedPercent(purchase.cost, purchase.lotComp) ?? purchase.percentageBought)}% of comp</p> : null}
                    <p>Location: {locationName(purchase.location)}</p>
                    <p>Receipt requested: {receiptChoiceLabel(purchase.receiptRequested)}</p>
                    <p>{lineItemsOf(purchase).map((item) => `${item.description || 'Item'} ${item.grader || ''} ${item.certNumber || ''} ${item.verificationStatus || ''}`).join(' · ')}</p>
                    {purchase.notes ? <p>{purchase.notes}</p> : null}
                    <PhotoStrip label="Card photos" photos={(purchase.photos && purchase.photos.cards) || {}} />
                    <PhotoStrip label="Payment proof" photos={(purchase.photos && purchase.photos.payment) || {}} />
                    <PhotoStrip label="Seller ID" photos={(purchase.photos && purchase.photos.id) || {}} reveal />
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => printSlip(purchase)}>Print label</button>
                      <button type="button" className="btn btn-ghost" onClick={() => printReceipt(purchase)}>Print / PDF</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing((value) => !value)}>{editing ? 'Close edit' : 'Edit'}</button>
                      <button type="button" className="btn btn-ghost" onClick={async () => {
                        if (!purchase.deleted && !window.confirm(`Remove slip #${purchase.purchaseNumber}? A manager can restore it.`)) return;
                        try {
                          await setPurchaseDeleted(purchase, profile, settings, !purchase.deleted);
                        } catch (err) {
                          setError(plainError(err));
                        }
                      }}>{purchase.deleted ? 'Restore' : 'Remove'}</button>
                    </div>
                    {editing ? <PurchaseEditor purchase={purchase} profile={profile} settings={settings} onClose={() => setEditing(false)} /> : null}
                  </div>
                ) : null}
              </article>
            ))}
            {visible < filtered.length ? <button type="button" className="btn btn-ghost" onClick={() => setVisible((count) => count + 40)}>Show older buys</button> : null}
          </section>
        )}
      </main>
    </div>
  );
}

function rangeCaption(range) {
  if (!range.from && !range.to) return 'All time';
  if (range.from && range.to && range.from === range.to) return formatDisplayDate(range.from);
  if (range.from && range.to) return `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`;
  if (range.from) return `From ${formatDisplayDate(range.from)}`;
  return `Through ${formatDisplayDate(range.to)}`;
}

function StatButton({ label, value, onClick }) {
  return (
    <button type="button" className="stat-btn" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function RangeCard({ title, range, purchases, onOpen }) {
  const block = sumPurchases((purchases || []).filter((purchase) => purchaseInRange(purchase, range)));
  return (
    <article className="card stack">
      <h2>{title}</h2>
      <p className="hint">{rangeCaption(range)}. Tap a total to see how it was paid.</p>
      <div className="stat-grid">
        <StatButton label="Slips" value={String(block.slips)} onClick={onOpen} />
        <StatButton label="Total" value={money(block.cost)} onClick={onOpen} />
        <StatButton label="Cash out" value={money(block.cashDrawer)} onClick={onOpen} />
        <StatButton label="Store credit" value={money(block.storeCredit)} onClick={onOpen} />
        <StatButton label="Cards" value={String(block.cards)} onClick={onOpen} />
        <StatButton label="Needs manager" value={String(block.pending)} onClick={onOpen} />
      </div>
    </article>
  );
}

function TenderDrill({ purchases, range, title, onBack, onPick }) {
  const rows = tenderBreakdown(purchases, range);
  const block = sumPurchases((purchases || []).filter((purchase) => purchaseInRange(purchase, range)));
  return (
    <section className="stack" data-testid="tender-breakdown">
      <button type="button" className="btn btn-ghost" onClick={onBack}>Back to summary</button>
      <article className="card stack">
        <h2>How buys were paid</h2>
        <p>{title} · {rangeCaption(range)}</p>
        <p className="hint">
          {block.slips} slips · {money(block.cost)} total. Cash out ({money(block.cashDrawer)}) is cash plus the safe.
          Tap a payment type to see those buys.
        </p>
      </article>
      {rows.map((row) => (
        <button type="button" className="card tender-row" key={row.key} data-testid={`tender-${row.key}`} onClick={() => onPick(row.key)}>
          <strong>{row.label}</strong>
          <span>{money(row.total)}</span>
          <span className="hint">{row.count} {row.count === 1 ? 'buy' : 'buys'}</span>
        </button>
      ))}
    </section>
  );
}

function TenderBuys({ purchases, range, methodKey, title, onBack }) {
  const method = tenderBreakdown(purchases, range).find((row) => row.key === methodKey)
    || { key: methodKey, label: methodKey, total: 0, count: 0 };
  const rows = purchasesForTender(purchases, range, method.key);
  return (
    <section className="stack" data-testid="tender-buys">
      <button type="button" className="btn btn-ghost" onClick={onBack}>Back to payment types</button>
      <article className="card stack">
        <h2>{method.label}</h2>
        <p>{title} · {rangeCaption(range)}</p>
        <p className="hint">{money(method.total)} across {method.count} {method.count === 1 ? 'buy' : 'buys'}</p>
      </article>
      {rows.length === 0 ? <p className="card">No buys were paid with {method.label} in this range.</p> : rows.map((purchase) => (
        <article className="card" key={purchase.firebaseKey || purchase.purchaseNumber} data-testid="tender-buy">
          <strong>#{purchase.purchaseNumber} · {formatDisplayDate(purchase.date)}</strong>
          <p>{purchase.boughtFrom || 'No seller'} · {method.label} {money(purchase[method.key])}</p>
          <p className="hint">Cost {money(purchase.cost)}{paymentSummary(purchase) ? ` · ${paymentSummary(purchase)}` : ''}</p>
        </article>
      ))}
    </section>
  );
}

function SummaryPanel({ purchases, locations }) {
  const today = todayISO();
  const [location, setLocation] = useState('any');
  const scoped = location === 'any'
    ? purchases
    : (purchases || []).filter((purchase) => locationName(purchase.location).toLowerCase() === locationName(location).toLowerCase());
  const periods = [
    { id: 'day', title: 'Today', from: today, to: today },
    { id: 'week', title: 'This week', from: startOfWeekISO(), to: today },
    { id: 'month', title: 'This month', from: startOfMonthISO(), to: today },
    { id: 'all', title: 'All time', from: '', to: '' },
  ];
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [drill, setDrill] = useState(null);
  const customActive = Boolean(customFrom || customTo);
  const customRange = { id: 'custom', title: 'Selected dates', from: customFrom, to: customTo };

  function openRange(period) {
    setDrill({
      level: 'tenders',
      range: { from: period.from, to: period.to },
      title: period.title,
      methodKey: '',
    });
  }

  const place = location === 'any' ? '' : locationName(location);

  if (drill && drill.level === 'buys') {
    return (
      <TenderBuys
        purchases={scoped}
        range={drill.range}
        methodKey={drill.methodKey}
        title={place ? `${drill.title} · ${place}` : drill.title}
        onBack={() => setDrill({ ...drill, level: 'tenders', methodKey: '' })}
      />
    );
  }
  if (drill && drill.level === 'tenders') {
    return (
      <TenderDrill
        purchases={scoped}
        range={drill.range}
        title={place ? `${drill.title} · ${place}` : drill.title}
        onBack={() => setDrill(null)}
        onPick={(methodKey) => setDrill({ ...drill, level: 'buys', methodKey })}
      />
    );
  }

  return (
    <section className="stack" data-testid="summary-panel">
      <article className="card stack">
        <h2>Date range</h2>
        <p className="hint">Pick a location and a day or range, then tap Cash out or any total. Buys with no location count as In Shop.</p>
        <label>Location
          <select value={location} onChange={(event) => { setLocation(event.target.value); setDrill(null); }}>
            <option value="any">All locations</option>
            {(locations || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="grid-2">
          <label>From
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
          </label>
          <label>To
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </label>
        </div>
        {customActive ? (
          <button type="button" className="btn btn-ghost" onClick={() => { setCustomFrom(''); setCustomTo(''); }}>Clear dates</button>
        ) : null}
      </article>
      {customActive ? (
        <RangeCard title={place ? `Selected dates · ${place}` : 'Selected dates'} range={customRange} purchases={scoped} onOpen={() => openRange(customRange)} />
      ) : null}
      {periods.map((period) => (
        <RangeCard key={period.id} title={place ? `${period.title} · ${place}` : period.title} range={period} purchases={scoped} onOpen={() => openRange(period)} />
      ))}
    </section>
  );
}

function PeoplePanel({ users, profile, settings }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createShopUser({ ...form, shopId: settings.shopId });
      setNotice(`${form.name} can sign in now.`);
      setForm({ name: '', email: '', password: '', role: 'staff' });
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <form className="card stack" onSubmit={submit}>
        <h2>Add a person</h2>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>Temporary password<input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} required /></label>
        <label>Role
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="staff">Staff — log buys only</option>
            <option value="manager">Manager — desk, money, and IDs</option>
          </select>
        </label>
        {error ? <p className="banner warn">{error}</p> : null}
        {notice ? <p className="banner ok">{notice}</p> : null}
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Adding…' : 'Add login'}</button>
      </form>
      {users.map((user) => (
        <article className="card row-spread" key={user.firebaseKey}>
          <div>
            <strong>{user.name}</strong>
            <p className="hint">{user.email} · {user.role}{user.disabled ? ' · disabled' : ''}</p>
          </div>
          {user.firebaseKey !== profile.uid ? (
            <button type="button" className="btn btn-ghost" onClick={() => setUserDisabled(user.firebaseKey, !user.disabled).catch((err) => setError(plainError(err)))}>
              {user.disabled ? 'Enable' : 'Disable'}
            </button>
          ) : <span className="hint">This is you</span>}
        </article>
      ))}
    </section>
  );
}

function SettingsPanel({ settings }) {
  const [form, setForm] = useState(settings);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => setForm(settings), [settings]);

  async function save(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const next = normalizeSettings({ ...form, shopId: settings.shopId });
      await update(ref(db, 'settings'), next);
      setNotice('Saved. Staff use these rates and rules on the next buy.');
    } catch (err) {
      setError(plainError(err));
    }
  }

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Shop settings</h2>
      <label>Shop name<input value={form.shopName || ''} onChange={(event) => set('shopName', event.target.value)} /></label>
      <label>Short name<input value={form.shopShortName || ''} onChange={(event) => set('shopShortName', event.target.value)} /></label>
      <label>Tagline<input value={form.tagline || ''} onChange={(event) => set('tagline', event.target.value)} /></label>
      <label>Accent color<input type="color" value={form.accentColor || '#ed1c24'} onChange={(event) => set('accentColor', event.target.value)} /></label>
      <p className="hint">Shop id: {settings.shopId}. New buys keep this id so a later version could add another shop. It is not a login, and this site still runs one shop.</p>
      <label className="check"><input type="checkbox" checked={form.idRequired !== false} onChange={(event) => set('idRequired', event.target.checked)} /> Require a seller ID photo</label>
      <label>ID required at or above
        <input type="number" min="0" step="0.01" value={form.idThreshold} onChange={(event) => set('idThreshold', event.target.value)} />
      </label>
      <p className="hint">Turn the switch off to stop requiring IDs. Otherwise staff cannot save a buy at or above this amount without an ID photo, unless that seller already has one on file.</p>
      <div className="grid-2">
        <label>Cash offer %<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={form.cashPercent} onChange={(event) => set('cashPercent', event.target.value)} /></label>
        <label>Store credit offer %<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={form.creditPercent} onChange={(event) => set('creditPercent', event.target.value)} /></label>
      </div>
      <label>Manager must approve buys at or above
        <input type="number" min="0" step="0.01" value={form.approvalAmount} onChange={(event) => set('approvalAmount', event.target.value)} />
      </label>
      <p className="hint">Use 0 if the dollar amount should not force approval. Offers above the cash or store-credit percent still need a manager.</p>
      {error ? <p className="banner warn">{error}</p> : null}
      {notice ? <p className="banner ok">{notice}</p> : null}
      <button className="btn btn-primary" type="submit">Save settings</button>
    </form>
  );
}

function ActivityPanel({ rows }) {
  const sorted = [...rows].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return (
    <section className="stack">
      {sorted.slice(0, 200).map((row) => (
        <article className="card" key={row.firebaseKey}>
          <strong>{row.action} · slip #{row.purchaseNumber}</strong>
          <p className="hint">{row.byName} · {row.at ? new Date(row.at).toLocaleString() : ''}</p>
          <p>{row.summary}</p>
        </article>
      ))}
      {sorted.length === 0 ? <p>No activity yet. New buys will show up here. Older buys from before sign-in do not have a log entry.</p> : null}
    </section>
  );
}

function SellersPanel({ sellers, purchases, settings, firebaseUser }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [privateInfo, setPrivateInfo] = useState(null);
  const [error, setError] = useState('');
  const matches = sellers.filter((seller) => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return false;
    return `${seller.name || ''} ${seller.phone || ''}`.toLowerCase().includes(q);
  }).slice(0, 12);
  const history = selected ? sellerHistory(purchases, selected) : [];

  async function showPrivate() {
    setError('');
    try {
      const snap = await get(ref(db, `sellerPrivate/${selected.id}`));
      const value = snap.val();
      if (!value || !value.idCiphertext) {
        setPrivateInfo({ note: 'No encrypted ID number is stored. The ID photo, if there is one, is on the buy.' });
        return;
      }
      const token = await firebaseUser.getIdToken();
      const response = await decryptIdentity(token, [{ id: selected.id, ciphertext: value.idCiphertext, iv: value.idIv }]);
      setPrivateInfo((response.results && response.results[0] && response.results[0].payload) || { note: 'Could not read the ID number.' });
    } catch (err) {
      setError(plainError(err));
    }
  }

  return (
    <section className="stack">
      <label>Find a seller
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or phone" />
      </label>
      {matches.map((seller) => (
        <button type="button" className="card tx-main" key={seller.id} onClick={() => { setSelected(seller); setPrivateInfo(null); }}>
          <strong>{seller.name}</strong>
          <span className="hint">{seller.phone} {seller.hasIdPhoto ? '· ID on file' : ''}</span>
        </button>
      ))}
      {selected ? (
        <article className="card stack">
          <h2>{selected.name}</h2>
          <p>{history.length} buys · {money(history.reduce((sum, purchase) => sum + Number(purchase.cost || 0), 0))}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => printHtml(sellerReportHtml(selected, history, { shopName: settings.shopName }))}>Print history</button>
            <button type="button" className="btn btn-ghost" onClick={() => downloadText(`${selected.name}-buys.csv`, purchasesToCsv(history))}>Download history</button>
            <button type="button" className="btn btn-ghost" onClick={showPrivate}>Show ID details</button>
          </div>
          {privateInfo ? <pre className="private-box">{privateInfo.note || `ID ${privateInfo.idNumber || ''}\nDOB ${privateInfo.dob || ''}\n${privateInfo.address || ''} ${privateInfo.city || ''} ${privateInfo.state || ''} ${privateInfo.zip || ''}`}</pre> : null}
          {error ? <p className="banner warn">{error}</p> : null}
          <div className="stack">
            {history.map((purchase) => (
              <article className="history-card" key={purchase.firebaseKey}>
                <strong>#{purchase.purchaseNumber} · {formatDisplayDate(purchase.date)}</strong>
                <span>{money(purchase.cost)} · {statusLabel(purchase.inventoryStatus)}</span>
              </article>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function CompliancePanel({ purchases, firebaseUser, settings }) {
  const alerts = cashAlerts(purchases);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setError('');
    try {
      const chosen = purchases.filter((purchase) => !purchase.deleted && (!from || purchase.date >= from) && (!to || purchase.date <= to));
      let privateBySellerId = {};
      try {
        const snap = await get(ref(db, 'sellerPrivate'));
        const all = snap.val() || {};
        const items = Object.entries(all).filter(([, value]) => value && value.idCiphertext).map(([id, value]) => ({
          id, ciphertext: value.idCiphertext, iv: value.idIv,
        })).slice(0, 100);
        if (items.length) {
          const token = await firebaseUser.getIdToken();
          const response = await decryptIdentity(token, items);
          privateBySellerId = {};
          (response.results || []).forEach((row) => { privateBySellerId[row.id] = row.payload || {}; });
        }
      } catch (err) {
        setError(`${plainError(err)} The file will still download without ID numbers.`);
      }
      downloadText(`${settings.shopShortName}-compliance-${from || 'all'}.csv`, complianceToCsv(complianceRows(chosen, privateBySellerId)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <article className="card stack">
        <h2>Cash over $10,000 in a day</h2>
        <p className="hint">This counts drawer cash and safe cash for one seller on one date. It is a reminder about IRS Form 8300, not tax advice. Nothing is filed from here.</p>
        {alerts.length === 0 ? <p>No seller is over $10,000 cash in a single day.</p> : alerts.map((alert) => (
          <p key={`${alert.date}-${alert.name}`}><strong>{alert.name}</strong> · {formatDisplayDate(alert.date)} · {money(alert.cash)} cash · {alert.count} buys</p>
        ))}
      </article>
      <article className="card stack">
        <h2>Reporting export</h2>
        <p className="hint">A spreadsheet with seller, ID details, items, photo paths, and payout. It does not send anything to LeadsOnline or anyone else. Photo paths are private locations, not public links.</p>
        <div className="grid-2">
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {error ? <p className="banner warn">{error}</p> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={download}>{busy ? 'Preparing…' : 'Download compliance file'}</button>
      </article>
    </section>
  );
}
