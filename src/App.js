import React, { useState, useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = '708254067981-icjtn5h6jc60h6v6khko7ksujv73t36o.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const DailyBuyingTracker = () => {
  const [purchases, setPurchases] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('')
  const [nextPurchaseNumber, setNextPurchaseNumber] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const printRef = useRef();
  
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
    cost: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('buyingTrackerData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPurchases(data);
        setNextPurchaseNumber(data.length + 1);
      } catch (e) {
        console.error('Failed to load data');
      }
    }

    const savedEmail = localStorage.getItem('userEmail');
    const savedFileId = localStorage.getItem('googleDriveFileId');
    const savedLoginState = localStorage.getItem('isLoggedIn');
    
    if (savedEmail && savedLoginState === 'true') {
      setUserEmail(savedEmail);
      setIsLoggedIn(true);
    }

    loadGoogleAPI();
  }, []);

 const loadGoogleAPI = () => {
  if (window.gapi) return; // Already loaded
  
  const script = document.createElement('script');
  script.src = 'https://apis.google.com/js/platform.js';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    if (window.gapi && window.gapi.load) {
      window.gapi.load('auth2', () => {
        // Auth2 is ready
      });
    }
  };
  document.head.appendChild(script);
};

  const handleGoogleLogin = () => {
    window.gapi.load('auth2', () => {
      const auth2 = window.gapi.auth2.init({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES.join(' ')
      });

      auth2.signIn().then(googleUser => {
        const profile = googleUser.getBasicProfile();
        setUserEmail(profile.getEmail());
        setIsLoggedIn(true);
        localStorage.setItem('userEmail', profile.getEmail());
        localStorage.setItem('isLoggedIn', 'true');
      });
    });
  };

  const handleGoogleLogout = () => {
    window.gapi.auth2.getAuthInstance().signOut().then(() => {
      setIsLoggedIn(false);
      setUserEmail('');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('googleDriveFileId');
    });
  };

  useEffect(() => {
    localStorage.setItem('buyingTrackerData', JSON.stringify(purchases));
  }, [purchases]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddAndPrint = (e) => {
    e.preventDefault();
    
    if (!formData.date || !formData.buyerName || !formData.cost) {
      alert('Please fill in Date, Buyer Name, and Cost');
      return;
    }

    const newPurchase = {
      id: Date.now(),
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
      cost: parseFloat(formData.cost) || 0
    };

    setPurchases([...purchases, newPurchase]);
    setNextPurchaseNumber(nextPurchaseNumber + 1);

    setTimeout(() => {
      printBuyingSlip(newPurchase);
    }, 100);

    setFormData(prev => ({
      ...prev,
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
      cost: ''
    }));
  };

  const printBuyingSlip = (purchase) => {
    const printWindow = window.open('', '', 'width=600,height=400');
    const dateStr = new Date(purchase.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Buying Slip #${purchase.purchaseNumber}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 0.25in; }
          .slip { width: 4in; height: 6in; border: 1px solid #000; padding: 0.25in; box-sizing: border-box; }
          h2 { font-size: 16px; margin-bottom: 0.1in; }
          .field { margin-bottom: 0.15in; font-size: 11px; }
          .label { font-weight: bold; display: inline-block; width: 1.2in; }
          .value { display: inline-block; }
          .checkbox-group { margin: 0.1in 0; }
          .checkbox-row { display: flex; gap: 0.2in; font-size: 10px; margin-bottom: 0.05in; }
          .checkbox { display: flex; gap: 0.05in; align-items: center; }
          input[type="checkbox"] { width: 12px; height: 12px; cursor: pointer; }
          .cost-section { border-top: 2px solid #000; margin-top: 0.2in; padding-top: 0.1in; }
          .cost-label { font-weight: bold; font-size: 14px; }
          .cost-value { font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="slip">
          <h2>BUYING SLIP Purchase #: ${purchase.purchaseNumber}</h2>
          
          <div class="field">
            <span class="label">Date:</span>
            <span class="value">${dateStr}</span>
          </div>
          
          <div class="field">
            <span class="label">Lot Comp:</span>
            <span class="value">$${purchase.lotComp.toFixed(2)}</span>
          </div>
          
          <div class="checkbox-group">
            <div class="checkbox-row">
              <div class="checkbox">
                <input type="checkbox" ${purchase.cash > 0 ? 'checked' : ''} disabled>
                <span>CASH $${purchase.cash.toFixed(2)}</span>
              </div>
              <div class="checkbox">
                <input type="checkbox" ${purchase.venmo > 0 ? 'checked' : ''} disabled>
                <span>VENMO $${purchase.venmo.toFixed(2)}</span>
              </div>
            </div>
            <div class="checkbox-row">
              <div class="checkbox">
                <input type="checkbox" ${purchase.cashApp > 0 ? 'checked' : ''} disabled>
                <span>CASH APP $${purchase.cashApp.toFixed(2)}</span>
              </div>
              <div class="checkbox">
                <input type="checkbox" ${purchase.zelle > 0 ? 'checked' : ''} disabled>
                <span>ZELLE $${purchase.zelle.toFixed(2)}</span>
              </div>
            </div>
            <div class="checkbox-row">
              <div class="checkbox">
                <input type="checkbox" ${purchase.paypal > 0 ? 'checked' : ''} disabled>
                <span>PAYPAL $${purchase.paypal.toFixed(2)}</span>
              </div>
              <div class="checkbox">
                <input type="checkbox" ${purchase.trade > 0 ? 'checked' : ''} disabled>
                <span>TRADE $${purchase.trade.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="field">
            <span class="label">% Bought at:</span>
            <span class="value">${purchase.percentageBought.toFixed(2)}</span>
          </div>
          
          <div class="field">
            <span class="label"># of Cards:</span>
            <span class="value">${purchase.numCards.toFixed(0)}</span>
          </div>
          
          <div class="field">
            <span class="label">Buyer Name:</span>
            <span class="value">${purchase.buyerName}</span>
          </div>

          <div class="field">
            <span class="label">Bought From:</span>
            <span class="value">${purchase.boughtFrom}</span>
          </div>
          
          <div class="cost-section">
            <div class="cost-label">COST:</div>
            <div class="cost-value">$${purchase.cost.toFixed(2)}</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDeletePurchase = (id) => {
    setPurchases(purchases.filter(p => p.id !== id));
  };

  const totals = {
    cost: purchases.reduce((sum, p) => sum + p.cost, 0),
    cash: purchases.reduce((sum, p) => sum + p.cash, 0),
    venmo: purchases.reduce((sum, p) => sum + p.venmo, 0),
    cashApp: purchases.reduce((sum, p) => sum + p.cashApp, 0),
    zelle: purchases.reduce((sum, p) => sum + p.zelle, 0),
    paypal: purchases.reduce((sum, p) => sum + p.paypal, 0),
    trade: purchases.reduce((sum, p) => sum + p.trade, 0),
    lotComp: purchases.reduce((sum, p) => sum + p.lotComp, 0),
    percentageBought: purchases.reduce((sum, p) => sum + p.percentageBought, 0),
    numCards: purchases.reduce((sum, p) => sum + p.numCards, 0)
  };

  const groupedByDate = purchases.reduce((acc, purchase) => {
    const date = purchase.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(purchase);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1rem', fontFamily: "'Segoe UI', 'Roboto', sans-serif" }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ color: '#f1f5f9', fontSize: '2rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
            Buying Slip Tracker
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
            Input purchases to print & track
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {!isLoggedIn ? (
              <button
                onClick={handleGoogleLogin}
                style={{
                  background: 'linear-gradient(135deg, #4285f4 0%, #1967d2 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                ☁️ Sign in
              </button>
            ) : (
              <>
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.5rem 1rem', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                  {userEmail}
                </div>
                <button
                  onClick={handleGoogleLogout}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Sign out
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowSummary(!showSummary)}
              style={{
                background: showSummary ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {showSummary ? 'Hide' : 'Show'} Daily Summary
            </button>
          </div>
        </div>

        {/* Form Section */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)', marginBottom: '2rem' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: '600', marginTop: 0, marginBottom: '1.5rem' }}>New Buying Slip</h2>
          
          <form onSubmit={handleAddAndPrint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Lot Comp</label>
                <input
                  type="number"
                  name="lotComp"
                  value={formData.lotComp}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="0.01"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Payment Methods</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Cash</label>
                  <input type="number" name="cash" value={formData.cash} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Venmo</label>
                  <input type="number" name="venmo" value={formData.venmo} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Cash App</label>
                  <input type="number" name="cashApp" value={formData.cashApp} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Zelle</label>
                  <input type="number" name="zelle" value={formData.zelle} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>PayPal</label>
                  <input type="number" name="paypal" value={formData.paypal} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Trade</label>
                  <input type="number" name="trade" value={formData.trade} onChange={handleInputChange} placeholder="0" step="0.01" style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>% Bought at</label>
                <input
                  type="number"
                  name="percentageBought"
                  value={formData.percentageBought}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="0.01"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}># of Cards</label>
                <input
                  type="number"
                  name="numCards"
                  value={formData.numCards}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="1"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Buyer Name *</label>
              <input
                type="text"
                name="buyerName"
                value={formData.buyerName}
                onChange={handleInputChange}
                placeholder="Buyer name"
                style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Bought From</label>
              <input
                type="text"
                name="boughtFrom"
                value={formData.boughtFrom}
                onChange={handleInputChange}
                placeholder="Seller name"
                style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.3rem' }}>Cost *</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleInputChange}
                placeholder="0"
                step="0.01"
                style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                padding: '0.8rem 1.5rem',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🖨️ Add & Print Slip
            </button>
          </form>
        </div>

        {/* Summary Section */}
        {showSummary && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)', marginBottom: '2rem' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600', marginTop: 0, marginBottom: '1rem' }}>Daily Summary</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              {[
                { label: 'Total Slips', value: purchases.length },
                { label: 'Total Cost', value: '$' + totals.cost.toFixed(2) },
                { label: 'Cash', value: '$' + totals.cash.toFixed(2) },
                { label: 'Venmo', value: '$' + totals.venmo.toFixed(2) },
                { label: 'Cash App', value: '$' + totals.cashApp.toFixed(2) },
                { label: 'Zelle', value: '$' + totals.zelle.toFixed(2) },
                { label: 'PayPal', value: '$' + totals.paypal.toFixed(2) },
                { label: 'Trade', value: '$' + totals.trade.toFixed(2) },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem', borderRadius: '6px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '500', margin: '0 0 0.3rem 0' }}>
                    {item.label}
                  </p>
                  <p style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchases History */}
        {purchases.length > 0 && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600', marginTop: 0, marginBottom: '1rem' }}>
              History
            </h2>

            {sortedDates.map(date => (
              <div key={date} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: '600', margin: '0 0 0.8rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {groupedByDate[date].map((purchase) => (
                    <div key={purchase.id} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <div>
                          <p style={{ color: '#f1f5f9', fontWeight: '600', margin: 0 }}>Slip #{purchase.purchaseNumber}</p>
                          <p style={{ color: '#cbd5e1', margin: '0.2rem 0 0 0' }}>{purchase.buyerName}</p>
                        </div>
                        <button
                          onClick={() => handleDeletePurchase(purchase.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: 'none',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#94a3b8' }}>
                        <p style={{ margin: 0 }}>Cost: <span style={{ color: '#f1f5f9' }}>${purchase.cost.toFixed(2)}</span></p>
                        <p style={{ margin: 0 }}>Cards: <span style={{ color: '#f1f5f9' }}>{purchase.numCards}</span></p>
                        <p style={{ margin: 0 }}>Lot Comp: <span style={{ color: '#f1f5f9' }}>${purchase.lotComp.toFixed(2)}</span></p>
                        <p style={{ margin: 0 }}>%: <span style={{ color: '#f1f5f9' }}>{purchase.percentageBought.toFixed(2)}</span></p>
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