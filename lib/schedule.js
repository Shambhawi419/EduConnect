const TONES = ['rose', 'lav', 'mint'];

export function publicEvent(e) {
  return {
    id: e._id.toString(),
    title: e.title,
    notes: e.notes || '',
    startsAt: e.startsAt,
    durationMinutes: e.durationMinutes,
    room: e.room || '',
    points: typeof e.points === 'number' ? e.points : null,
    tone: e.tone,
  };
}

export function parseEventBody(body) {
  const { title, notes, startsAt, durationMinutes, room, points, tone } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'A title is required' };
  }
  const when = new Date(startsAt);
  if (!startsAt || Number.isNaN(when.getTime())) {
    return { error: 'A valid start date and time is required' };
  }

  const duration = durationMinutes === undefined ? 60 : Number(durationMinutes);
  if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
    return { error: 'Duration must be between 5 and 600 minutes' };
  }

  let score;
  if (points !== undefined && points !== null && points !== '') {
    score = Number(points);
    if (!Number.isFinite(score) || score < 0 || score > 1000) {
      return { error: 'Points must be between 0 and 1000' };
    }
  }

  return {
    data: {
      title: title.trim().slice(0, 80),
      notes: typeof notes === 'string' ? notes.trim().slice(0, 300) : '',
      startsAt: when,
      durationMinutes: duration,
      room: typeof room === 'string' ? room.trim().slice(0, 20) : '',
      points: score,
      tone: TONES.includes(tone) ? tone : 'lav',
    },
  };
}
