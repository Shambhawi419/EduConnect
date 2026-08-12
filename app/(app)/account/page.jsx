'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import { IconBack } from '@/components/Icons';

export default function AccountPage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const data = await api.mfaSetup();
      setQr(data.qrDataUrl);
    });

  const enable = (e) => {
    e.preventDefault();
    return run(async () => {
      const data = await api.mfaEnable(code);
      setUser(data.user);
      setQr(null);
      setCode('');
      setSuccess('MFA is now enabled on your account.');
    });
  };

  const disable = (e) => {
    e.preventDefault();
    return run(async () => {
      const data = await api.mfaDisable(code);
      setUser(data.user);
      setCode('');
      setSuccess('MFA has been disabled.');
    });
  };

  const signOut = async () => {
    await logout();
    router.push('/login');
  };

  const signOutEverywhere = () =>
    run(async () => {
      await api.logoutAll();
      setUser(null);
      router.push('/login');
    });

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display sm" style={{ margin: 0 }}>
            Security
          </h1>
        </div>
        <Link href="/" className="circle-btn" title="Back">
          <IconBack />
        </Link>
      </header>

      <div className="split-grid">
      <div className="panel panel-white">
        <p className="section-title">Multi-factor authentication</p>
        <p className="muted-note" style={{ marginBottom: 18 }}>
          {user?.email}
        </p>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {user?.mfaEnabled ? (
          <form onSubmit={disable}>
            <p className="muted-note" style={{ marginBottom: 16 }}>
              MFA is currently <b style={{ color: 'var(--ink)' }}>enabled</b>. Enter a code to turn it off.
            </p>
            <div className="field">
              <label>Authentication code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" required />
            </div>
            <button className="pill-btn danger block" disabled={busy}>
              {busy ? 'Disabling…' : 'Disable MFA'}
            </button>
          </form>
        ) : qr ? (
          <form onSubmit={enable}>
            <p className="muted-note">
              Scan this QR code with Google Authenticator, Authy, or a similar app, then enter the code it shows.
            </p>
            <div className="mfa-qr">
              <img src={qr} alt="MFA setup QR code" width={190} height={190} />
            </div>
            <div className="field">
              <label>Authentication code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" required />
            </div>
            <button className="pill-btn block" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm & enable'}
            </button>
          </form>
        ) : (
          <>
            <p className="muted-note" style={{ marginBottom: 16 }}>
              MFA is currently <b style={{ color: 'var(--ink)' }}>disabled</b>. Add an authenticator app for stronger
              protection.
            </p>
            <button className="pill-btn block" onClick={startSetup} disabled={busy}>
              {busy ? 'Starting…' : 'Set up MFA'}
            </button>
          </>
        )}
      </div>

      <div className="panel panel-white">
        <p className="section-title">Sessions</p>
        <p className="muted-note" style={{ marginBottom: 18 }}>
          Signed in as {user?.name} · <span className={`badge ${user?.role}`}>{user?.role}</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="pill-btn ghost block" type="button" onClick={signOut}>
            Log out
          </button>
          <button className="pill-btn tinted block" type="button" onClick={signOutEverywhere} disabled={busy}>
            Log out of all devices
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
