# Deploying CNTRD to Render

CNTRD is a single Express app: API + static SPA, served from one Node
process. SQLite for storage, multer-on-disk for uploads.

There are two ways to ship it on Render — pick one based on whether you
need the data to survive deploys.

---

## Option A — Free tier (ephemeral)

Best for demos and previews. The database resets on every restart or
redeploy, and Render puts the service to sleep after ~15 minutes of
inactivity (cold-start adds a few seconds on the next request).

1. Push this repo to GitHub.
2. In Render dashboard: **New +** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and provisions one **Web Service** named
   `cntrd` on the free plan. `JWT_SECRET` is generated automatically.
4. Wait for the first build (~2 minutes) and visit the public URL.

That's it — sign up creates a real account, posts persist… until the
next restart.

## Option B — Persistent storage (paid)

Same setup, but with a small persistent disk so signups, posts, and
uploaded avatars survive restarts. ~$8/month total ($7 web + $1 disk).

In `render.yaml`, uncomment three things:

```yaml
plan: starter           # change `free` → `starter`
…
envVars:
  - key: DATABASE_PATH        # uncomment
    value: /var/data/cntrd.db
  - key: UPLOADS_PATH         # uncomment
    value: /var/data/uploads

disk:                         # uncomment the whole block
  name: cntrd-data
  mountPath: /var/data
  sizeGB: 1
```

Push, then in the dashboard **Manual Deploy → Clear build cache &
deploy**. The disk mounts at `/var/data`; the app creates
`cntrd.db` + `uploads/` there on first boot.

---

## Manual setup (no Blueprint)

If you'd rather click through the dashboard:

1. **New +** → **Web Service** → connect repo.
2. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Environment variables:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (click *Generate*)
   - `ADMIN_EMAILS` = your email (comma-separate for more, but for personal
     use set just yours). Auto-promotes that account to admin on next
     login/register. See **Becoming admin** below.
   - For persistent storage, also: `DATABASE_PATH` = `/var/data/cntrd.db`,
     `UPLOADS_PATH` = `/var/data/uploads`.
4. (Persistent only) **Disks** → add `cntrd-data`, mount path
   `/var/data`, size `1 GB`.
5. **Create Web Service**.

---

## Becoming admin

CNTRD has an admin role with three powers:
- See every account that has signed up
- Ban / unban accounts
- Delete any post

Only emails listed in `ADMIN_EMAILS` (comma-separated, env var on the
service) become admin. Steps:

1. Render dashboard → your service → **Environment** → add
   `ADMIN_EMAILS` = `you@example.com`. Save.
2. Wait for the redeploy.
3. Sign up (or log in) with that exact email. Your account is flagged
   as admin automatically — no DB poking needed.
4. In the app: **Settings → Admin → Open admin console**. On desktop
   the **Admin** item also appears in the left nav.

Promotion is idempotent on every login/register and on `GET /me`, so
adding or removing yourself from `ADMIN_EMAILS` takes effect on the
next request without restarting. Admins cannot be banned by other
admins, and you cannot ban yourself.

## Custom domain

After deploy: **Settings → Custom Domains → Add Custom Domain**, then
add the CNAME / A records Render shows you. TLS is automatic.

---

## Troubleshooting

- **Build fails on `better-sqlite3`** — Render's Node runtime ships
  Python and `gcc`, so the prebuilt binary should install fine. If it
  doesn't, bump `engines.node` in `package.json` to `>=20` and redeploy
  to pick up the right prebuild.
- **502 / "Application failed to respond"** — check the **Logs** tab.
  Most often it's `PORT` (the app already reads `process.env.PORT`, so
  this is rare) or a missing env var.
- **Cold starts on free tier** — that's the plan. Use a paid plan or
  pair the free service with an external uptime ping (UptimeRobot etc.)
  if you need it always-on.
- **Data disappeared after a deploy** — you're on free tier; this is
  expected. Move to Option B.

---

## What lives where in the repo

```
server.js              Express app + SPA fallback
database/db.js         SQLite + idempotent schema migrations
data/teams.js          Static team registry (server-side)
routes/                REST API (auth, users, posts, plays, upload, static)
middleware/auth.js     JWT bearer-token middleware
public/                Static SPA — index.html + js/cntrd/*.jsx
render.yaml            Render Blueprint
```
