'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import BlobArt from '@/components/BlobArt';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
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
      const data = await api.register(form);
      login(data.user);
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-blob">
          <BlobArt />
        </div>
        <div className="auth-brand">EduConnect</div>
        <p className="auth-title">
          Create your
          <br />
          account
        </p>
        <p className="auth-subtitle">Join EduConnect to get a personalized study workspace.</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input value={form.name} onChange={update('name')} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update('email')} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={8}
            />
            <p className="muted-note" style={{ fontSize: 12 }}>
              At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a
              symbol.
            </p>
          </div>
          <div className="field">
            <label>Role</label>
            <div className="segmented">
              <button
                type="button"
                className={form.role === 'student' ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, role: 'student' }))}
              >
                Student
              </button>
              <button
                type="button"
                className={form.role === 'admin' ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, role: 'admin' }))}
              >
                Admin
              </button>
            </div>
          </div>
          <button className="pill-btn block" disabled={busy}>
            {busy ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="muted-note" style={{ marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ fontWeight: 600, color: 'var(--ink)' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
