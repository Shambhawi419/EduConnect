# EduConnect

A study workspace for college students, built as a single **Next.js** app.

Three features, all behind a secure login:

- **AI Tutor** — chat that resolves academic doubts with step-by-step explanations
- **PDF → Quiz** — upload lecture notes and get a multiple-choice quiz with explanations.
  Built as retrieval-augmented generation (RAG): each PDF is split into passages, embedded
  and stored once; a quiz then retrieves the relevant passages (for a topic you type, or
  spread across the whole document) and writes questions from only those, each citing its
  source page
- **Schedule** — a personal timetable you fill in yourself, with computed free-time gaps

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) — UI **and** API in one app |
| UI | React 19, plain CSS |
| Database | MongoDB via Mongoose |
| AI | OpenAI — `gpt-4o-mini` for chat and questions, `text-embedding-3-small` for retrieval |
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
lib/              db, jwt, cookies, auth guard, csrf, rateLimit, mfa, rag, api client, openai
models/           Mongoose schemas: User, RefreshToken, StudyEvent, RateLimit,
                  QuizDocument, QuizChunk
```

## How the quiz retrieval works

1. **Index (once per PDF)** — `POST /api/quiz/documents` extracts the text page by page,
   cuts it into ~1,800-character overlapping passages, embeds each with
   `text-embedding-3-small` (512 dimensions) and stores passage + vector in MongoDB
   (`QuizChunk`). A PDF is processed once and can be reused for many quizzes.
2. **Retrieve (per quiz)** — `POST /api/quiz/generate`. With a topic, the topic is embedded
   and the closest passages are chosen. With no topic, passages are chosen to be as
   different from each other as possible, so a long document is covered end to end. Both
   use Maximal Marginal Relevance (`lib/rag.js`); similarity is computed in Node, so no
   vector database is needed at this scale.
3. **Generate** — the model sees only the retrieved passages, each with a question quota,
   and every question is returned with its source page and the supporting sentence.

Uploaded documents belong to one user and are deleted automatically after 30 days
(MongoDB TTL index), or earlier from the Source tab. Limits: 4 MB per PDF, 5 documents per
user.

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
