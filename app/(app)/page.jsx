'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import BlobArt from '@/components/BlobArt';
import {
  IconSearch,
  IconDots,
  IconFilter,
  IconArrowUpRight,
  IconClock,
  IconDoc,
  IconLock,
} from '@/components/Icons';

// The three things EduConnect actually does. The chips below filter this list.
const FEATURES = [
  { id: 'tutor', label: 'Tutor' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'security', label: 'Security' },
];

export default function DashboardPage() {
  const { user, setUser } = useAuth();
  const [filters, setFilters] = useState(FEATURES.map((f) => f.id));
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Refresh the cached user so the counters below reflect work done this session.
  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, [setUser]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const initial = firstName[0]?.toUpperCase() || '?';
  const chats = user?.stats?.chatMessages ?? 0;
  const quizzes = user?.stats?.quizzesGenerated ?? 0;

  const removeFilter = (id) => setFilters((f) => f.filter((t) => t !== id));
  const shown = (id, title) =>
    filters.includes(id) && title.toLowerCase().includes(query.trim().toLowerCase());

  return (
    <div className="panel panel-warm">
      <header className="panel-head">
        <div className="avatar-photo">{initial}</div>
        <div className="head-actions">
          <button
            className="circle-btn"
            type="button"
            title="Search"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <IconSearch />
          </button>
          <Link href="/account" className="circle-btn" title="Account">
            <IconDots />
          </Link>
        </div>
      </header>

      <p className="eyebrow">Hello, {firstName}</p>
      <h1 className="display">
        Your Study
        <br />
        Workspace
      </h1>

      {searchOpen && (
        <div className="field">
          <input
            autoFocus
            placeholder="Search your tools…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div className="chip-scroller">
        <button
          className="circle-btn sm"
          type="button"
          title="Show all"
          onClick={() => setFilters(FEATURES.map((f) => f.id))}
        >
          <IconFilter width={17} height={17} />
        </button>
        {FEATURES.filter((f) => filters.includes(f.id)).map((f) => (
          <button key={f.id} className="chip-x" type="button" onClick={() => removeFilter(f.id)}>
            {f.label} <i>×</i>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        {shown('tutor', 'AI Tutor') && (
          <article className="topic-card">
            <div className="topic-head">
              <h3>AI Tutor</h3>
              <Link href="/chat" className="circle-btn flat sm" title="Open tutor">
                <IconDots width={17} height={17} />
              </Link>
            </div>
            <p className="topic-desc">Ask any doubt and get clear, step-by-step explanations.</p>

            <div className="topic-stats">
              <div className="stats-left">
                <div className="stat-block">
                  <span>Chats</span>
                  <b>{chats}</b>
                </div>
                <div className="stat-block">
                  <span>Quizzes</span>
                  <b>{quizzes}</b>
                </div>
                <div className="stat-time">
                  <IconClock width={15} height={15} />
                  Available 24/7
                </div>
              </div>

              <div className="stats-art">
                <BlobArt />
              </div>

              <Link href="/chat" className="circle-btn dark go-btn" title="Open the tutor">
                <IconArrowUpRight />
              </Link>
            </div>
          </article>
        )}

        <div className="dash-side">
          {shown('quizzes', 'PDF to Quiz') && (
            <Link href="/quiz" className="row-card rose">
              <div className="row-icon">
                <IconDoc width={21} height={21} />
              </div>
              <div className="row-text">
                <b>PDF to Quiz</b>
                <span>
                  {quizzes > 0
                    ? `Turn notes into practice questions · ${quizzes} generated`
                    : 'Turn your lecture notes into a practice quiz.'}
                </span>
              </div>
            </Link>
          )}

          {shown('security', 'Security') && (
            <Link href="/account" className="row-card mint">
              <div className="row-icon">
                <IconLock width={21} height={21} />
              </div>
              <div className="row-text">
                <b>Security</b>
                <span>
                  Two-factor {user?.mfaEnabled ? 'enabled' : 'off'} · signed in as {user?.role}
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {filters.length === 0 && (
        <p className="muted-note">All tools hidden — tap the filter icon to bring them back.</p>
      )}
    </div>
  );
}
