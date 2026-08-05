import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  IconBook,
  IconChat,
  IconCalendar,
  IconGrid,
  IconLock,
  IconAdmin,
  IconLogout,
} from './Icons';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = [
    { to: '/', end: true, Icon: IconBook, label: 'Home' },
    { to: '/chat', Icon: IconChat, label: 'Tutor' },
    { to: '/schedule', Icon: IconCalendar, label: 'Schedule' },
    { to: '/quiz', Icon: IconGrid, label: 'Quiz' },
    { to: '/account', Icon: IconLock, label: 'Security' },
  ];
  if (user?.role === 'admin') {
    items.push({ to: '/admin', Icon: IconAdmin, label: 'Admin' });
  }

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Desktop navigation — hidden below 1024px, where the bottom pill takes over. */}
      <aside className="sidebar">
        <div className="side-brand">
          <span className="brand-mark">E</span>
          EduConnect
        </div>

        <nav className="side-nav">
          {items.map(({ to, end, Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon width={19} height={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="side-user">
          <div className="avatar-photo sm">{user?.name?.[0]?.toUpperCase() || '?'}</div>
          <div className="side-user-text">
            <b>{user?.name}</b>
            <span>{user?.role}</span>
          </div>
          <button className="circle-btn sm" type="button" title="Log out" onClick={signOut}>
            <IconLogout width={17} height={17} />
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {items.map(({ to, end, Icon, label }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')} title={label}>
            <Icon />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
