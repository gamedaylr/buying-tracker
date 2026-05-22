import React, { useState, useEffect } from 'react';
import gamedayLogo from './gameday-logo.png';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAjHoxB4h09Ame44C5MowR_IrbqNdANH8E",
  authDomain: "gameday-buying-tracker.firebaseapp.com",
  projectId: "gameday-buying-tracker",
  storageBucket: "gameday-buying-tracker.firebasestorage.app",
  messagingSenderId: "363561073964",
  appId: "1:363561073964:web:f96c0e8b485f76796e0089",
  databaseURL: "https://gameday-buying-tracker-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DailyBuyingTracker = () => {
  const [purchases, setPurchases] = useState([]);
  const [nextPurchaseNumber, setNextPurchaseNumber] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    lotComp: '',
    percentageBought: '',
    numCards: '',
    buyerName: '',
    boughtFrom: '',
    cash: '',
    venmo: '',
    cashApp: '',
    zelle: '',
    paypal: '',
    trade: '',
    cashFromSafe: '',
    cost: ''
  });

  useEffect(() => {
    const purchasesRef = ref(database, 'purchases');
    onValue(purchasesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const purchasesArray = Object.entries(data).map(([key, value]) => ({
          ...value,
          firebaseKey: key
        }));
        setPurchases(purchasesArray);
        setNextPurchaseNumber(purchasesArray.length + 1);
      } else {
        setPurchases([]);
        setNextPurchaseNumber(1);
      }
      setLoading(false);
    });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAndPrint = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.buyerName || !formData.cost) {
      alert('Please fill in Date, Buyer Name, and Cost');
      return;
    }

    const newPurchase = {
      purchaseNumber: nextPurchaseNumber,
      date: formData.date,
      lotComp: parseFloat(formData.lotComp) || 0,
      percentageBought: parseFloat(formData.percentageBought) || 0,
      numCards: parseFloat(formData.numCards) || 0,
      buyerName: formData.buyerName,
      boughtFrom: formData.boughtFrom,
      cash: parseFloat(formData.cash) || 0,
      venmo: parseFloat(formData.venmo) || 0,
      cashApp: parseFloat(formData.cashApp) || 0,
      zelle: parseFloat(formData.zelle) || 0,
      paypal: parseFloat(formData.paypal) || 0,
      trade: parseFloat(formData.trade) || 0,
      cashFromSafe: parseFloat(formData.cashFromSafe) || 0,
      cost: parseFloat(formData.cost) || 0,
      timestamp: new Date().toISOString()
    };

    try {
      await push(ref(database, 'purchases'), newPurchase);
      setTimeout(() => { printBuyingSlip(newPurchase); }, 100);
      setFormData(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        lotComp: '', percentageBought: '', numCards: '', buyerName: '', boughtFrom: '',
        cash: '', venmo: '', cashApp: '', zelle: '', paypal: '', trade: '', cashFromSafe: '', cost: ''
      }));
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const printBuyingSlip = (purchase) => {
    const printWindow = window.open('', '', 'width=600,height=400');
    const dateStr = new Date(purchase.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Slip #${purchase.purchaseNumber}</title><style>*{margin:0;padding:0}body{font-family:Arial;padding:0.25in}.slip{width:4in;height:6in;border:1px solid #000;padding:0.15in;box-sizing:border-box;font-size:13px}h2{font-size:18px;margin-bottom:0.08in}.field{margin-bottom:0.12in;font-size:12px}.label{font-weight:bold;display:inline-block;width:1.1in}.checkbox-row{display:flex;gap:0.15in;font-size:11px;margin-bottom:0.04in}.cost-section{border-top:2px solid #000;margin-top:0.2in;padding-top:0.1in}.cost-value{font-weight:bold;font-size:20px}</style></head><body><div class="slip"><h2>SLIP #${purchase.purchaseNumber}</h2><div class="field"><span class="label">Date:</span>${dateStr}</div><div class="field"><span class="label">Comp:</span>$${purchase.lotComp.toFixed(2)}</div><div style="margin:0.08in 0"><div class="checkbox-row"><input type="checkbox" ${purchase.cash > 0 ? 'checked' : ''} disabled> CASH $${purchase.cash.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.cashFromSafe > 0 ? 'checked' : ''} disabled> SAFE $${purchase.cashFromSafe.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.venmo > 0 ? 'checked' : ''} disabled> VENMO $${purchase.venmo.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.cashApp > 0 ? 'checked' : ''} disabled> CASH APP $${purchase.cashApp.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.zelle > 0 ? 'checked' : ''} disabled> ZELLE $${purchase.zelle.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.paypal > 0 ? 'checked' : ''} disabled> PAYPAL $${purchase.paypal.toFixed(2)}</div><div class="checkbox-row"><input type="checkbox" ${purchase.trade > 0 ? 'checked' : ''} disabled> TRADE $${purchase.trade.toFixed(2)}</div></div><div class="field"><span class="label">%:</span>${purchase.percentageBought.toFixed(2)}</div><div class="field"><span class="label">#:</span>${purchase.numCards}</div><div class="field"><span class="label">Buyer:</span>${purchase.buyerName}</div><div class="field"><span class="label">From:</span>${purchase.boughtFrom}</div><div class="cost-section"><div>COST: <span class="cost-value">$${purchase.cost.toFixed(2)}</span></div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDeletePurchase = async (firebaseKey) => {
    if (window.confirm('Delete this purchase?')) {
      try {
        await remove(ref(database, `purchases/${firebaseKey}`));
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  const exportToCSV = () => {
    if (purchases.length === 0) { alert('No data'); return; }
    let csv = 'Purchase #,Date,Buyer,From,Comp,%,Cards,Cash,Safe,Venmo,CashApp,Zelle,PayPal,Trade,Cost\n';
    purchases.forEach(p => {
      csv += `${p.purchaseNumber},"${p.date}","${p.buyerName}","${p.boughtFrom}",${p.lotComp},${p.percentageBought},${p.numCards},${p.cash},${p.cashFromSafe},${p.venmo},${p.cashApp},${p.zelle},${p.paypal},${p.trade},${p.cost}\n`;
    });
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `GameDay-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const totals = {
    slips: purchases.length,
    cost: purchases.reduce((sum, p) => sum + p.cost, 0),
    cash: purchases.reduce((sum, p) => sum + p.cash, 0),
    cashFromSafe: purchases.reduce((sum, p) => sum + p.cashFromSafe, 0),
    venmo: purchases.reduce((sum, p) => sum + p.venmo, 0),
    cashApp: purchases.reduce((sum, p) => sum + p.cashApp, 0),
    zelle: purchases.reduce((sum, p) => sum + p.zelle, 0),
    paypal: purchases.reduce((sum, p) => sum + p.paypal, 0),
    trade: purchases.reduce((sum, p) => sum + p.trade, 0),
  };

  const today = new Date();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const weeklyTotals = { cost: purchases.filter(p => new Date(p.date) >= weekStart).reduce((sum, p) => sum + p.cost, 0) };
  const monthlyTotals = { cost: purchases.filter(p => new Date(p.date) >= monthStart).reduce((sum, p) => sum + p.cost, 0) };

  const groupedByDate = purchases.reduce((acc, purchase) => {
    if (!acc[purchase.date]) acc[purchase.date] = [];
    acc[purchase.date].push(purchase);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  if (loading) return <div style={{ minHeight: '100vh', background: '#231F20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#FFF' }}>Loading...</p></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #231F20 0%, #2a2628 100%)', padding: '1rem', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <img src={gamedayLogo} alt="GameDay" style={{ maxWidth: '180px', marginBottom: '1.5rem' }} />
          <h1 style={{ color: '#FFF', fontSize: '2rem', fontWeight: '700', margin: 0 }}>Buying Slip Tracker</h1>
          <p style={{ color: '#D1D3D4', fontSize: '0.9rem', marginTop: '0.5rem' }}>GameDay Sports Cards</p>
          
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button onClick={() => setShowSummary(!showSummary)} style={{ background: 'rgba(237,28,36,0.1)', color: '#ED1C24', border: '1px solid rgba(237,28,36,0.3)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
              {showSummary ? 'Hide' : 'Show'} Summary
            </button>
            <button onClick={exportToCSV} style={{ background: 'rgba(237,28,36,0.1)', color: '#ED1C24', border: '1px solid rgba(237,28,36,0.3)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
              📥 Download CSV
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(35,31,32,0.8)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(209,211,212,0.3)', marginBottom: '2rem' }}>
          <h2 style={{ color: '#FFF', fontSize: '1.2rem', marginTop: 0, marginBottom: '1.5rem' }}>New Buying Slip</h2>
          
          <form onSubmit={handleAddAndPrint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Date *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Lot Comp</label>
                <input type="number" name="lotComp" value={formData.lotComp} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Payment Methods</label>
              <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr 1fr' : '1fr 1fr 1fr', gap: '0.8rem' }}>
                {[{ n: 'cash', l: 'Cash' }, { n: 'cashFromSafe', l: 'Safe' }, { n: 'venmo', l: 'Venmo' }, { n: 'cashApp', l: 'CashApp' }, { n: 'zelle', l: 'Zelle' }, { n: 'paypal', l: 'PayPal' }, { n: 'trade', l: 'Trade' }].map(m => (
                  <div key={m.n}>
                    <label style={{ color: '#D1D3D4', fontSize: '0.75rem' }}>{m.l}</label>
                    <input type="number" name={m.n} value={formData[m.n]} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '4px', color: '#FFF', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>% Bought</label><input type="number" name="percentageBought" value={formData.percentageBought} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} /></div>
              <div><label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}># Cards</label><input type="number" name="numCards" value={formData.numCards} onChange={handleInputChange} placeholder="0" step="1" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} /></div>
            </div>

            <div><label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Buyer Name *</label><input type="text" name="buyerName" value={formData.buyerName} onChange={handleInputChange} placeholder="Buyer name" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} /></div>
            <div><label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Bought From</label><input type="text" name="boughtFrom" value={formData.boughtFrom} onChange={handleInputChange} placeholder="Seller name" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} /></div>
            <div><label style={{ display: 'block', color: '#D1D3D4', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Cost *</label><input type="number" name="cost" value={formData.cost} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.6rem', background: 'rgba(20,18,19,0.5)', border: '1px solid rgba(209,211,212,0.3)', borderRadius: '6px', color: '#FFF', boxSizing: 'border-box' }} /></div>

            <button type="submit" style={{ background: 'linear-gradient(135deg, #ED1C24 0%, #b01219 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>🖨️ Add & Print Slip</button>
          </form>
        </div>

        {showSummary && (
          <div style={{ background: 'rgba(35,31,32,0.8)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(209,211,212,0.3)', marginBottom: '2rem' }}>
            <h2 style={{ color: '#FFF', fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>Daily Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
              {[{ l: 'Slips', v: totals.slips }, { l: 'Total', v: '$' + totals.cost.toFixed(2) }, { l: 'Cash', v: '$' + totals.cash.toFixed(2) }, { l: 'Safe', v: '$' + totals.cashFromSafe.toFixed(2) }, { l: 'Venmo', v: '$' + totals.venmo.toFixed(2) }, { l: 'CashApp', v: '$' + totals.cashApp.toFixed(2) }, { l: 'Zelle', v: '$' + totals.zelle.toFixed(2) }, { l: 'PayPal', v: '$' + totals.paypal.toFixed(2) }, { l: 'Trade', v: '$' + totals.trade.toFixed(2) }].map(item => (
                <div key={item.l} style={{ background: 'rgba(20,18,19,0.5)', padding: '0.8rem', borderRadius: '6px' }}>
                  <p style={{ color: '#D1D3D4', fontSize: '0.75rem', margin: 0 }}>{item.l}</p>
                  <p style={{ color: '#FFF', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{item.v}</p>
                </div>
              ))}
            </div>

            <h3 style={{ color: '#FFF', fontSize: '1rem', margin: '0 0 0.5rem 0' }}>This Week: ${weeklyTotals.cost.toFixed(2)}</h3>
            <h3 style={{ color: '#FFF', fontSize: '1rem', margin: 0 }}>This Month: ${monthlyTotals.cost.toFixed(2)}</h3>
          </div>
        )}

        {purchases.length > 0 && (
          <div style={{ background: 'rgba(35,31,32,0.8)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(209,211,212,0.3)' }}>
            <h2 style={{ color: '#FFF', fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>History</h2>
            {sortedDates.map(date => (
              <div key={date} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#D1D3D4', fontSize: '0.95rem', margin: '0 0 0.8rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(209,211,212,0.3)' }}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {groupedByDate[date].map((purchase) => (
                    <div key={purchase.firebaseKey} style={{ background: 'rgba(20,18,19,0.5)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div><p style={{ color: '#FFF', fontWeight: '600', margin: 0 }}>#{purchase.purchaseNumber}</p><p style={{ color: '#D1D3D4', margin: '0.2rem 0 0 0' }}>{purchase.buyerName}</p></div>
                        <button onClick={() => handleDeletePurchase(purchase.firebaseKey)} style={{ background: 'rgba(237,28,36,0.2)', color: '#ED1C24', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#D1D3D4' }}>
                        <p style={{ margin: 0 }}>Cost: <span style={{ color: '#FFF' }}>${purchase.cost.toFixed(2)}</span></p>
                        <p style={{ margin: 0 }}>Cards: <span style={{ color: '#FFF' }}>{purchase.numCards}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyBuyingTracker;