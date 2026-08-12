'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import BlobArt from '@/components/BlobArt';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.login(form);
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
      } else {
        login(data.user);
        router.replace('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.verifyMfaLogin({ mfaToken, code });
      login(data.user);
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (mfaToken) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-blob">
            <BlobArt />
          </div>
          <div className="auth-brand">EduConnect</div>
          <p className="auth-title">Two-factor check</p>
          <p className="auth-subtitle">Enter the 6-digit code from your authenticator app.</p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={submitMfa}>
            <div className="field">
              <label>Authentication code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
            <button className="pill-btn block" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-blob">
          <BlobArt />
        </div>
        <div className="auth-brand">EduConnect</div>
        <p className="auth-title">
          Welcome
          <br />
          back
        </p>
        <p className="auth-subtitle">Log in to continue your syllabus.</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update('email')} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update('password')} required />
          </div>
          <button className="pill-btn block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="muted-note" style={{ marginTop: 20 }}>
          New here?{' '}
          <Link href="/register" style={{ fontWeight: 600, color: 'var(--ink)' }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
