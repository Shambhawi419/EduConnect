'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconBack } from '@/components/Icons';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="display sm" style={{ margin: 0 }}>
            All users
          </h1>
        </div>
        <Link href="/" className="circle-btn" title="Back">
          <IconBack />
        </Link>
      </header>

      <div className="panel panel-white">
        <p className="muted-note" style={{ marginBottom: 18 }}>
          Admin-only view, protected by role-based access control on the server.
        </p>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <p className="muted-note">Loading…</p>
        ) : (
          <div className="admin-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((u) => (
              <div key={u._id} className="lesson">
                <div className="avatar-photo sm">{u.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="lesson-text">
                  <b>{u.name}</b>
                  <span>{u.email}</span>
                </div>
                <span className={`badge ${u.role}`}>{u.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
