'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import {
  IconBook,
  IconChat,
  IconCalendar,
  IconGrid,
  IconLock,
  IconAdmin,
  IconLogout,
} from './Icons';

// Replaces both the react-router <Protected> wrapper and the old Layout.
export default function AppShell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <div className="center-page">Loading…</div>;
  if (!user) return <div className="center-page">Redirecting…</div>;

  const items = [
    { href: '/', Icon: IconBook, label: 'Home' },
    { href: '/chat', Icon: IconChat, label: 'Tutor' },
    { href: '/schedule', Icon: IconCalendar, label: 'Schedule' },
    { href: '/quiz', Icon: IconGrid, label: 'Quiz' },
    { href: '/account', Icon: IconLock, label: 'Security' },
  ];
  if (user.role === 'admin') {
    items.push({ href: '/admin', Icon: IconAdmin, label: 'Admin' });
  }

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="brand-mark">E</span>
          EduConnect
        </div>

        <nav className="side-nav">
          {items.map(({ href, Icon, label }) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
              <Icon width={19} height={19} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="side-user">
          <div className="avatar-photo sm">{user.name?.[0]?.toUpperCase() || '?'}</div>
          <div className="side-user-text">
            <b>{user.name}</b>
            <span>{user.role}</span>
          </div>
          <button className="circle-btn sm" type="button" title="Log out" onClick={signOut}>
            <IconLogout width={17} height={17} />
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {items.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''} title={label}>
            <Icon />
          </Link>
        ))}
      </nav>
    </div>
  );
}
