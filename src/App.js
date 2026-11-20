import React, { useEffect, useState } from 'react';
import AuthProvider, { useAuth } from './auth/AuthProvider';
import BuyScreen from './components/BuyScreen';
import {
  BlockedScreen,
  LoadingScreen,
  LoginScreen,
  MissingProfile,
  SetupScreen,
} from './components/LoginScreens';
import ManagerDesk from './components/ManagerDesk';
import { isManagerRole } from './lib/buying';

function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/buy');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/buy');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function Shell() {
  const { status, configError, profile, settings, signOutShop } = useAuth();
  const route = useRoute();
  const [forceLogin, setForceLogin] = useState(false);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accentColor || '#ed1c24');
    document.title = `${settings.shopShortName} buying desk`;
  }, [settings]);

  if (status === 'loading') return <LoadingScreen settings={settings} />;
  if (status === 'blocked') return <BlockedScreen settings={settings} message={configError} />;
  if (status === 'missing') return <MissingProfile settings={settings} onSignOut={signOutShop} />;
  if (status === 'setup' && !forceLogin) {
    return (
      <SetupScreen
        settings={settings}
        showSignIn={<button type="button" className="btn btn-text" onClick={() => setForceLogin(true)}>I already have a login</button>}
      />
    );
  }
  if (status === 'signedout' || forceLogin) {
    return <LoginScreen settings={settings} onSetup={status === 'setup' ? () => setForceLogin(false) : null} />;
  }
  if (route.startsWith('#/manage')) {
    if (!isManagerRole(profile.role)) {
      return (
        <main className="gate">
          <section className="card">
            <h1>Managers only</h1>
            <p>Your login can log buys and print slips. It cannot open the desk.</p>
            <a className="btn btn-primary" href="#/buy">Back to the buying desk</a>
          </section>
        </main>
      );
    }
    return <ManagerDesk />;
  }
  return <BuyScreen onManage={isManagerRole(profile.role)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
