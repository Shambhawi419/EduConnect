const express = require('express');
const mongoose = require('mongoose');
const StudyEvent = require('../models/StudyEvent');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Every handler below is scoped to req.user._id, so one account can never read or
// mutate another account's events even if it guesses a valid event id.
router.use(requireAuth);

const TONES = ['rose', 'lav', 'mint'];

function publicEvent(e) {
  return {
    id: e._id,
    title: e.title,
    notes: e.notes || '',
    startsAt: e.startsAt,
    durationMinutes: e.durationMinutes,
    room: e.room || '',
    points: typeof e.points === 'number' ? e.points : null,
    tone: e.tone,
  };
}

function parseBody(body) {
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

// GET /api/schedule?date=YYYY-MM-DD — one day's events, oldest first.
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const filter = { user: req.user._id };

    if (date) {
      const dayStart = new Date(`${date}T00:00:00`);
      if (Number.isNaN(dayStart.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      filter.startsAt = { $gte: dayStart, $lt: dayEnd };
    }

    const events = await StudyEvent.find(filter).sort({ startsAt: 1 });
    res.json({ events: events.map(publicEvent) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load your schedule' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { error, data } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await StudyEvent.create({ ...data, user: req.user._id });
    res.status(201).json({ event: publicEvent(event) });
  } catch (err) {
    res.status(500).json({ message: 'Could not save that event' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const { error, data } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await StudyEvent.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      data,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });

    res.json({ event: publicEvent(event) });
  } catch (err) {
    res.status(500).json({ message: 'Could not update that event' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const event = await StudyEvent.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete that event' });
  }
});

module.exports = router;
