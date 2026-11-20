import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import logo from '../gameday-logo.png';
import { auth } from '../firebase';
import { initialShopId, normalizeSettings } from '../lib/buying';
import { plainError } from '../lib/errors';
import { bootstrapManager } from '../services/accounts';

export function Brand({ settings, large }) {
  return (
    <div className={large ? 'brand brand-large' : 'brand'}>
      <img src={logo} alt="" />
      <div>
        <strong>{settings.shopName}</strong>
        <span>{settings.tagline}</span>
      </div>
    </div>
  );
}

export function LoadingScreen({ settings }) {
  return (
    <main className="gate">
      <Brand settings={settings} large />
      <p>Loading the buying desk…</p>
    </main>
  );
}

export function BlockedScreen({ settings, message }) {
  return (
    <main className="gate">
      <Brand settings={settings} large />
      <section className="card">
        <h1>Sign-in is not ready</h1>
        <p>{message}</p>
        <p className="hint">The current live site is unchanged until this version is published and the new database rules are turned on. The setup steps are in the project README.</p>
      </section>
    </main>
  );
}

export function MissingProfile({ settings, onSignOut }) {
  return (
    <main className="gate">
      <Brand settings={settings} large />
      <section className="card">
        <h1>This login is not on the staff list</h1>
        <p>Ask a manager to add you from the People tab. Creating a password alone does not open the desk.</p>
        <button type="button" className="btn btn-primary" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}

export function LoginScreen({ settings, onSetup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Password reset email sent. Check the inbox for that address.');
    } catch (err) {
      setError(plainError(err));
    }
  }

  return (
    <main className="gate">
      <Brand settings={settings} large />
      <section className="card">
        <h1>Staff sign in</h1>
        <form onSubmit={submit} className="stack">
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="banner warn">{error}</p> : null}
          {notice ? <p className="banner ok">{notice}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button className="btn btn-text" type="button" onClick={reset}>Forgot password</button>
        </form>
        {onSetup ? <button type="button" className="btn btn-text" onClick={onSetup}>First time? Create the manager login</button> : null}
      </section>
    </main>
  );
}

export function SetupScreen({ settings, showSignIn }) {
  const [shopName, setShopName] = useState(settings.shopName);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const shop = normalizeSettings({ ...settings, shopName: shopName.trim(), shopId: initialShopId(shopName) });
      await bootstrapManager({ shop, name, email, password });
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <Brand settings={{ ...settings, shopName: shopName || settings.shopName }} large />
      <section className="card">
        <h1>Create the first manager</h1>
        <p className="hint">Do this once, as soon as the new site is published. This person can add everyone else. There is no shared PIN.</p>
        <form onSubmit={submit} className="stack">
          <label>Shop name
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} required />
          </label>
          <label>Your name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>Password
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          </label>
          {error ? <p className="banner warn">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create manager login'}</button>
        </form>
        {showSignIn}
      </section>
    </main>
  );
}
