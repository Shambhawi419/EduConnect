# EduConnect

A study workspace for college students, built as a single **Next.js** app.

Three features, all behind a secure login:

- **AI Tutor** — chat that resolves academic doubts with step-by-step explanations
- **PDF → Quiz** — upload lecture notes, get a multiple-choice quiz with explanations
- **Schedule** — a personal timetable you fill in yourself, with computed free-time gaps

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) — UI **and** API in one app |
| UI | React 19, plain CSS |
| Database | MongoDB via Mongoose |
| AI | OpenAI (`gpt-4o-mini`) |
| Auth | httpOnly cookies + rotating refresh tokens + TOTP MFA |

There is no separate backend server. API endpoints are Next Route Handlers under
`app/api/`, so the frontend and API share one origin and one deployment.

## Project layout

```
app/
  (app)/          authenticated pages (route group — not part of the URL)
    page.jsx        dashboard
    chat/ quiz/ schedule/ account/ admin/
  login/ register/  unauthenticated pages
  api/              route handlers (the former Express routes)
  layout.jsx        root layout: fonts + AuthProvider
  globals.css
components/       AppShell (sidebar + auth guard), AuthContext, Icons, BlobArt
lib/              db, jwt, cookies, auth guard, csrf, rateLimit, api client, openai
models/           Mongoose schemas: User, RefreshToken, StudyEvent
```

## Security

- **Sessions** — 15-minute access JWT + 7-day rotating refresh token, both httpOnly
  cookies. Only the SHA-256 hash of the refresh token is stored, so a database leak
  alone can't be replayed as a live session.
- **Theft detection** — reusing an already-rotated refresh token revokes every
  session for that user and bumps `tokenVersion`, which invalidates outstanding
  access tokens too.
- **Brute force** — database-backed account lockout (5 wrong passwords → 15-minute
  lock), plus a separate lockout for wrong MFA codes. Request rate limits are also
  stored in MongoDB (`lib/rateLimit.js`), so every serverless instance shares them;
  the OpenAI routes are limited per user.
- **CSRF** — double-submit token with a constant-time compare, on top of
  `SameSite=Lax`.
- **MFA** — optional TOTP via authenticator app.
- **RBAC** — `student` / `admin`, enforced server-side in each route handler.
  Registration always creates a `student`; promote an admin with
  `npm run make-admin -- you@example.com`.
- **Headers** — set in `next.config.mjs` (the former `helmet()`).

## Running locally

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

Requires a MongoDB instance — local (`mongodb://127.0.0.1:27017/educonnect`) or Atlas.

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel + MongoDB Atlas.
