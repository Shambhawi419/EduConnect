# Deploying EduConnect

One Next.js app, one deployment. Frontend and API ship together.

| Piece | Host |
| --- | --- |
| App (UI + API routes) | **Vercel** |
| Database | **MongoDB Atlas** |

> **Why this is simpler than the old split.** The previous version was an Express
> API and a separate Vite frontend on two different domains, which required CORS,
> `credentials: true`, and `SameSite=None` cookies. As one Next app everything is
> same-origin: no CORS, and `SameSite=Lax` is sufficient.

---

## 1. MongoDB Atlas

1. Create a free account at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a free **M0** cluster (free forever — no trial, no card).
3. **Database Access** → add a user; save the password.
4. **Network Access** → Add IP → *Allow access from anywhere* (`0.0.0.0/0`).
   Vercel's serverless functions get dynamic IPs, so an allowlist won't work.
5. **Connect → Drivers → Node.js** → copy the connection string and edit it:
   - replace `<db_password>` with the real password
   - add `educonnect` as the database name after `.net/`

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/educonnect?retryWrites=true&w=majority
```

> If the password contains `@ # $ % / :`, URL-encode those characters or the
> connection string will parse wrongly.

---

## 2. Generate token secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # ACCESS_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # REFRESH_TOKEN_SECRET
```

Two different values — a leaked access-token secret must not be able to mint refresh tokens.

---

## 3. Rotate your OpenAI key

1. <https://platform.openai.com/api-keys> → revoke the old key.
2. Create a new one.
3. **Settings → Limits** → set a monthly budget. Anyone who registers on the
   deployed app can spend against this key via the tutor and quiz endpoints.

---

## 4. Deploy to Vercel

1. <https://vercel.com> → **Add New → Project** → import the GitHub repo.
2. Framework preset is detected as **Next.js**. Leave build settings default.
3. Add **Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | the Atlas string from step 1 |
   | `ACCESS_TOKEN_SECRET` | from step 2 |
   | `REFRESH_TOKEN_SECRET` | from step 2 |
   | `ACCESS_TOKEN_TTL` | `15m` |
   | `OPENAI_API_KEY` | the new key from step 3 |

4. **Deploy.** You get `https://<project>.vercel.app`.

Cookies are marked `Secure` automatically because `NODE_ENV` is `production` on
Vercel — nothing to configure.

---

## 5. Verify

- [ ] `https://<your-app>.vercel.app/api/health` returns `{"status":"ok"}`
- [ ] Register an account → lands on the dashboard
- [ ] Reload → still logged in (session cookie survives)
- [ ] Add a schedule event → persists after reload
- [ ] Ask the tutor something → reply comes back
- [ ] Log out → redirected to `/login`

---

## Serverless notes

Two things behave differently on Vercel than on a long-running Node server:

**Database connections** — every route handler may cold-start in its own instance.
`lib/db.js` caches the Mongoose connection on `globalThis` so instances reuse it
instead of opening a new connection per request and exhausting Atlas's limit.

**Rate limiting** — `lib/rateLimit.js` counts requests in memory, which is *not*
shared across instances, so a distributed attacker can exceed the limits. It is a
speed bump, not the real defence: the authoritative brute-force protection is the
database-backed account lockout in `app/api/auth/login/route.js`, which every
instance sees. To make rate limiting authoritative too, swap the `Map` for Redis
(e.g. Upstash) — the function signatures are designed to stay the same.

**Function timeouts** — the OpenAI-backed routes declare `maxDuration = 60`. Vercel's
Hobby plan caps functions at 60s; a very large PDF may need the Pro plan.
