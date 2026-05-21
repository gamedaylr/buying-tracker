import React, { useState, useEffect } from 'react';

// Google API credentials
const GOOGLE_CLIENT_ID = '708254067981-icjtn5h6jc60h6v6khko7ksujv73t36o.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const DailyBuyingTracker = () => {
  const [purchases, setPurchases] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [fileId, setFileId] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    type: '',
    whatBought: '',
    numItems: '',
    comp: '',
    percentage: '',
    register: '',
    safe: '',
    cashApp: '',
    venmo: '',
    paypal: '',
    zelle: '',
    trade: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('buyingTrackerData');
    if (saved) {
      try {
        setPurchases(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load data');
      }
    }

    const savedEmail = localStorage.getItem('userEmail');
    const savedFileId = localStorage.getItem('googleDriveFileId');
    const savedLoginState = localStorage.getItem('isLoggedIn');
    
    if (savedEmail && savedLoginState === 'true') {
      setUserEmail(savedEmail);
      setFileId(savedFileId);
      setIsLoggedIn(true);
    }

    loadGoogleAPI();
  }, []);

  const loadGoogleAPI = () => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/platform.js';
    script.async = true;
    script.defer = true;
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
        autoSyncData();
      });
    });
  };

  const handleGoogleLogout = () => {
    window.gapi.auth2.getAuthInstance().signOut().then(() => {
      setIsLoggedIn(false);
      setUserEmail('');
      setFileId(null);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('googleDriveFileId');
    });
  };

  const autoSyncData = async () => {
    if (!isLoggedIn) return;
    
    setSyncStatus('syncing');
    try {
      if (fileId) {
        await loadDataFromGoogleDrive(fileId);
      }
      await saveDataToGoogleDrive();
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const saveDataToGoogleDrive = async () => {
    if (!isLoggedIn) return;

    const dataToSave = {
      purchases: purchases,
      lastUpdated: new Date().toISOString()
    };

    const token = window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token;

    try {
      if (fileId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataToSave)
        });
      } else {
        const metadata = {
          name: 'buying-tracker-data.json',
          mimeType: 'application/json',
          parents: ['root']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(dataToSave)], { type: 'application/json' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: form
        });

        const result = await response.json();
        setFileId(result.id);
        localStorage.setItem('googleDriveFileId', result.id);
      }
    } catch (err) {
      console.error('Failed to save to Google Drive:', err);
      throw err;
    }
  };

  const loadDataFromGoogleDrive = async (fId) => {
    if (!isLoggedIn) return;

    const token = window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token;

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPurchases(data.purchases || []);
      }
    } catch (err) {
      console.error('Failed to load from Google Drive:', err);
    }
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

  const handleAddPurchase = (e) => {
    e.preventDefault();
    
    if (!formData.date || !formData.name) {
      alert('Please fill in at least Date and Name');
      return;
    }

    const newPurchase = {
      id: Date.now(),
      ...formData,
      numItems: parseFloat(formData.numItems) || 0,
      comp: parseFloat(formData.comp) || 0,
      percentage: parseFloat(formData.percentage) || 0,
      register: parseFloat(formData.register) || 0,
      safe: parseFloat(formData.safe) || 0,
      cashApp: parseFloat(formData.cashApp) || 0,
      venmo: parseFloat(formData.venmo) || 0,
      paypal: parseFloat(formData.paypal) || 0,
      zelle: parseFloat(formData.zelle) || 0,
      trade: parseFloat(formData.trade) || 0
    };

    setPurchases([...purchases, newPurchase]);
    
    setFormData(prev => ({
      ...prev,
      name: '',
      type: '',
      whatBought: '',
      numItems: '',
      comp: '',
      percentage: '',
      register: '',
      safe: '',
      cashApp: '',
      venmo: '',
      paypal: '',
      zelle: '',
      trade: ''
    }));
  };

  const handleDeletePurchase = (id) => {
    setPurchases(purchases.filter(p => p.id !== id));
  };

  const handleExportToCSV = () => {
    if (purchases.length === 0) {
      alert('No data to export. Add some purchases first!');
      return;
    }

    const headers = ['Date', 'Name', 'Type', 'What We Bought', '# of Items', 'Comp', '%', 'Register', 'Safe', 'Cash App', 'Venmo', 'PayPal', 'Zelle', 'Trade'];
    
    const rows = purchases
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(p => [
        p.date,
        p.name,
        p.type,
        p.whatBought,
        p.numItems.toFixed(2),
        p.comp.toFixed(2),
        p.percentage.toFixed(2),
        p.register.toFixed(2),
        p.safe.toFixed(2),
        p.cashApp.toFixed(2),
        p.venmo.toFixed(2),
        p.paypal.toFixed(2),
        p.zelle.toFixed(2),
        p.trade.toFixed(2)
      ]);

    const totalsRow = [
      'TOTALS',
      '',
      '',
      '',
      totals.items.toFixed(2),
      totals.comp.toFixed(2),
      totals.percentage.toFixed(2),
      totals.register.toFixed(2),
      totals.safe.toFixed(2),
      totals.cashApp.toFixed(2),
      totals.venmo.toFixed(2),
      totals.paypal.toFixed(2),
      totals.zelle.toFixed(2),
      totals.trade.toFixed(2)
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      totalsRow.map(cell => `"${cell}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `buying-tracker-${today}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totals = {
    items: purchases.reduce((sum, p) => sum + p.numItems, 0),
    comp: purchases.reduce((sum, p) => sum + p.comp, 0),
    percentage: purchases.reduce((sum, p) => sum + p.percentage, 0),
    register: purchases.reduce((sum, p) => sum + p.register, 0),
    safe: purchases.reduce((sum, p) => sum + p.safe, 0),
    cashApp: purchases.reduce((sum, p) => sum + p.cashApp, 0),
    venmo: purchases.reduce((sum, p) => sum + p.venmo, 0),
    paypal: purchases.reduce((sum, p) => sum + p.paypal, 0),
    zelle: purchases.reduce((sum, p) => sum + p.zelle, 0),
    trade: purchases.reduce((sum, p) => sum + p.trade, 0)
  };

const totalAmount = totals.register + totals.safe + totals.cashApp + totals.venmo + totals.paypal + totals.zelle + totals.trade;

  const groupedByDate = purchases.reduce((acc, purchase) => {
    const date = purchase.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(purchase);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '2rem', fontFamily: "'Segoe UI', 'Roboto', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ color: '#f1f5f9', fontSize: '2.5rem', fontWeight: '700', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px' }}>
                Daily Buying Tracker
              </h1>
              <p style={{ color: '#cbd5e1', fontSize: '1rem', margin: 0 }}>
                Track and manage your purchases with ease
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'flex-end' }}>
              {!isLoggedIn ? (
                <button
                  onClick={handleGoogleLogin}
                  style={{
                    background: 'linear-gradient(135deg, #4285f4 0%, #1967d2 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.7rem 1.5rem',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  ☁️ Sign in with Google
                </button>
              ) : (
                <>
                  <div style={{ 
                    background: 'rgba(15, 23, 42, 0.8)', 
                    padding: '0.6rem 1rem', 
                    borderRadius: '6px',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                      {syncStatus === 'synced' ? '✓ Synced' : syncStatus === 'syncing' ? '⟳ Syncing...' : syncStatus === 'error' ? '✗ Sync failed' : '☁️ ' + userEmail}
                    </span>
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
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.3)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleExportToCSV}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.7rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            📊 Export to CSV
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: '600', marginTop: 0, marginBottom: '1.5rem' }}>New Purchase</h2>
            
            <form onSubmit={handleAddPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Person's name"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>
    Type
  </label>
  <select
    name="type"
    value={formData.type}
    onChange={handleInputChange}
    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box', cursor: 'pointer' }}
  >
    <option value="">Select Type</option>
    <option value="Sports Cards">Sports Cards</option>
    <option value="Pokemon">Pokemon</option>
    <option value="Other TCG">Other TCG</option>
    <option value="Mixture">Mixture</option>
  </select>
</div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>What We Bought</label>
                <input
                  type="text"
                  name="whatBought"
                  value={formData.whatBought}
                  onChange={handleInputChange}
                  placeholder="Item description"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}># of Items</label>
                <input
                  type="number"
                  name="numItems"
                  value={formData.numItems}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="0.01"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>Comp</label>
                  <input
                    type="number"
                    name="comp"
                    value={formData.comp}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>%</label>
                  <input
                    type="number"
                    name="percentage"
                    value={formData.percentage}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>Register</label>
                  <input
                    type="number"
                    name="register"
                    value={formData.register}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>Safe</label>
                  <input
                    type="number"
                    name="safe"
                    value={formData.safe}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>Cash App</label>
                  <input
                    type="number"
                    name="cashApp"
                    value={formData.cashApp}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>Venmo</label>
                  <input
                    type="number"
                    name="venmo"
                    value={formData.venmo}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>PayPal</label>
                  <input
                    type="number"
                    name="paypal"
                    value={formData.paypal}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.4rem' }}>Zelle</label>
                  <input
                    type="number"
                    name="zelle"
                    value={formData.zelle}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem' }}>Trade</label>
                <input
                  type="number"
                  name="trade"
                  value={formData.trade}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="0.01"
                  style={{ width: '100%', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.95rem', boxSizing: 'border-box' }}
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
                  marginTop: '0.5rem',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                + Add Purchase
              </button>
            </form>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: '600', marginTop: 0, marginBottom: '1.5rem' }}>Summary</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500', margin: '0 0 0.5rem 0' }}>Total Purchases</p>
                <p style={{ color: '#f1f5f9', fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>{purchases.length}</p>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500', margin: '0 0 0.5rem 0' }}>Total Items</p>
                <p style={{ color: '#f1f5f9', fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>{totals.items.toFixed(2)}</p>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem', borderLeft: '3px solid #f59e0b' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500', margin: '0 0 0.5rem 0' }}>TOTAL AMOUNT</p>
              <p style={{ color: '#fbbf24', fontSize: '2.2rem', fontWeight: '700', margin: 0 }}>
                ${totalAmount.toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              {[
                { label: 'Comp', value: totals.comp },
                { label: 'Register', value: totals.register },
                { label: 'Safe', value: totals.safe },
                { label: 'Cash App', value: totals.cashApp },
                { label: 'Venmo', value: totals.venmo },
                { label: 'PayPal', value: totals.paypal },
                { label: 'Zelle', value: totals.zelle },
                { label: 'Trade', value: totals.trade }
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem', borderRadius: '6px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '500', margin: '0 0 0.3rem 0' }}>
                    {item.label}
                  </p>
                 <p style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
  {item.label === '%' ? item.value.toFixed(2) : '$' + item.value.toFixed(2)}
</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: '600', marginTop: 0, marginBottom: '1.5rem' }}>
            Purchases
          </h2>

          {sortedDates.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
              No purchases yet. Add one to get started!
            </p>
          ) : (
            sortedDates.map(date => (
              <div key={date} style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#cbd5e1', fontSize: '1.1rem', fontWeight: '600', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(71, 85, 105, 0.3)' }}>
                        <th style={{ color: '#94a3b8', textAlign: 'left', padding: '0.8rem', fontWeight: '600' }}>Name</th>
                        <th style={{ color: '#94a3b8', textAlign: 'left', padding: '0.8rem', fontWeight: '600' }}>Type</th>
                        <th style={{ color: '#94a3b8', textAlign: 'left', padding: '0.8rem', fontWeight: '600' }}>What Bought</th>
                        <th style={{ color: '#94a3b8', textAlign: 'center', padding: '0.8rem', fontWeight: '600' }}>Items</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Comp</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>%</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Register</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Safe</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Cash App</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Venmo</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>PayPal</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Zelle</th>
                        <th style={{ color: '#94a3b8', textAlign: 'right', padding: '0.8rem', fontWeight: '600' }}>Trade</th>
                        <th style={{ color: '#94a3b8', textAlign: 'center', padding: '0.8rem', fontWeight: '600' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByDate[date].map((purchase, idx) => (
                        <tr key={purchase.id} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)', background: idx % 2 === 0 ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}>
                          <td style={{ color: '#e2e8f0', padding: '0.8rem' }}>{purchase.name}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem' }}>{purchase.type}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem' }}>{purchase.whatBought}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'center' }}>{purchase.numItems.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.comp.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.percentage.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.register.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.safe.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.cashApp.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.venmo.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.paypal.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.zelle.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'right' }}>${purchase.trade.toFixed(2)}</td>
                          <td style={{ color: '#cbd5e1', padding: '0.8rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeletePurchase(purchase.id)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                border: 'none',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.3)'}
                              onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyBuyingTracker;