import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { IconChevronDown, IconPlus, IconDots, IconClock } from '../components/Icons';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TONES = ['lav', 'rose', 'mint'];

function startOfWeek(input) {
  const date = new Date(input);
  const offset = (date.getDay() + 6) % 7; // shift so Monday is 0
  date.setDate(date.getDate() - offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildWeek(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Local YYYY-MM-DD — toISOString() would shift the day across timezones.
function dateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clockParts(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return { hour: h % 12 === 0 ? 12 : h % 12, meridiem: h < 12 ? 'AM' : 'PM' };
}

function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} Min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} Hour${hours > 1 ? 's' : ''}`;
}

// Insert a "free time" card wherever there's an hour or more between two events.
function withGaps(events) {
  const rows = [];
  events.forEach((e, i) => {
    rows.push({ kind: 'event', event: e });
    const next = events[i + 1];
    if (!next) return;
    const endsAt = new Date(e.startsAt).getTime() + e.durationMinutes * 60000;
    const gap = (new Date(next.startsAt).getTime() - endsAt) / 60000;
    if (gap >= 60) rows.push({ kind: 'free', minutes: gap, at: new Date(endsAt) });
  });
  return rows;
}

const EMPTY_FORM = { title: '', notes: '', time: '10:00', durationMinutes: 60, room: '', points: '', tone: 'lav' };

export default function Schedule() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const initial = user?.name?.[0]?.toUpperCase() || '?';
  const key = dateKey(selected);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listEvents(key);
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createEvent({
        title: form.title,
        notes: form.notes,
        startsAt: new Date(`${key}T${form.time}`).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        room: form.room,
        points: form.points,
        tone: form.tone,
      });
      setForm(EMPTY_FORM);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, title) => {
    if (!window.confirm(`Delete “${title}”?`)) return;
    setError('');
    try {
      await api.deleteEvent(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const week = buildWeek(selected);
  const monthLabel = selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();
  const rows = withGaps(events);

  return (
    <div className="sched-layout">
      <div className="sched-left">
      <div className="panel panel-white">
        <div className="cal-head">
          <h2>
            {monthLabel.replace(' ', ', ')}
            <IconChevronDown width={19} height={19} />
          </h2>
          <button
            className={`circle-btn ${adding ? 'dark' : ''}`}
            type="button"
            title={adding ? 'Cancel' : 'Add to schedule'}
            onClick={() => setAdding((v) => !v)}
          >
            <IconPlus style={{ transform: adding ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }} />
          </button>
        </div>

        <div className="week-strip">
          {week.map((day, i) => (
            <button
              key={day.toISOString()}
              type="button"
              className={`day-cell ${isSameDay(day, selected) ? 'active' : ''}`}
              onClick={() => setSelected(day)}
            >
              <span>{DAY_LABELS[i]}</span>
              <b>{day.getDate()}</b>
            </button>
          ))}
        </div>
      </div>

      {adding && (
        <div className="panel panel-white">
          <p className="section-title">New event</p>
          <p className="muted-note" style={{ marginBottom: 18 }}>
            On {selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <form onSubmit={save}>
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={update('title')} placeholder="Physics revision" required autoFocus />
            </div>
            <div className="field">
              <label>Notes</label>
              <input value={form.notes} onChange={update('notes')} placeholder="Chapters 4–6" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Start time</label>
                <input type="time" value={form.time} onChange={update('time')} required />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Minutes</label>
                <input type="number" min={5} max={600} value={form.durationMinutes} onChange={update('durationMinutes')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Room</label>
                <input value={form.room} onChange={update('room')} placeholder="244" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Points</label>
                <input type="number" min={0} max={1000} value={form.points} onChange={update('points')} placeholder="40" />
              </div>
            </div>
            <div className="field">
              <label>Colour</label>
              <div className="segmented">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={form.tone === t ? 'active' : ''}
                    onClick={() => setForm((f) => ({ ...f, tone: t }))}
                  >
                    {t === 'lav' ? 'Purple' : t === 'rose' ? 'Pink' : 'Mint'}
                  </button>
                ))}
              </div>
            </div>
            <button className="pill-btn block" disabled={saving}>
              {saving ? 'Saving…' : 'Add to schedule'}
            </button>
          </form>
        </div>
      )}
      </div>

      <div className="sched-right">
      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="muted-note">Loading your day…</p>
      ) : events.length === 0 ? (
        <div className="free-slot">
          <b>Nothing scheduled</b>
          <span>Tap + to add your first event</span>
        </div>
      ) : (
        <div className="timeline">
          {rows.map((row, i) => {
            const time = clockParts(row.kind === 'event' ? row.event.startsAt : row.at);
            return (
              <div className="slot" key={i}>
                <div className="slot-hour">
                  <b>{time.hour}</b>
                  <span>{time.meridiem}</span>
                </div>

                <div className="slot-body">
                  {row.kind === 'free' ? (
                    <div className="free-slot">
                      <b>🎉 You Have {durationLabel(row.minutes)}</b>
                      <span>Free Time</span>
                    </div>
                  ) : (
                    <div className={`event ${row.event.tone}`}>
                      <div className="event-head">
                        <h4>{row.event.title}</h4>
                        <button
                          className="circle-btn flat sm"
                          type="button"
                          title="Delete event"
                          onClick={() => remove(row.event.id, row.event.title)}
                        >
                          <IconDots width={17} height={17} />
                        </button>
                      </div>
                      {row.event.notes && <p>{row.event.notes}</p>}

                      {(row.event.room || row.event.points !== null) && (
                        <div className="event-meta">
                          {row.event.room && (
                            <div className="m">
                              <span>Room</span>
                              <b>{row.event.room}</b>
                            </div>
                          )}
                          {row.event.points !== null && (
                            <div className="m">
                              <span>Points</span>
                              <b>{row.event.points}</b>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="event-foot">
                        <span className="dur">
                          <IconClock width={15} height={15} />
                          {durationLabel(row.event.durationMinutes)}
                        </span>
                        <div className="avatar-photo sm">{initial}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
