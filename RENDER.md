# Deploying CNTRD to Render

CNTRD is a single Express app: API + static SPA, served from one Node
process. SQLite for storage, multer-on-disk for uploads. Both live on a
1 GB persistent disk so accounts and posts survive every redeploy.

Cost: ~$8/month (Starter web service + 1 GB disk).

---

## Blueprint deploy

1. Push this repo to GitHub.
2. In Render dashboard: **New +** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and provisions:
   - Web Service `cntrd` on the **Starter** plan.
   - 1 GB disk `cntrd-data` mounted at `/var/data`.
   - `DATABASE_PATH` / `UPLOADS_PATH` / `JWT_SECRET` / `ADMIN_EMAILS`
     env vars (the last is sync:false — set it in the dashboard).
4. Set `ADMIN_EMAILS` to your email under **Environment**, then **Save
   Changes** (triggers a redeploy).
5. Sign up with that email — you're admin on next login.

The DB lives at `/var/data/cntrd.db`, uploaded avatars at
`/var/data/uploads`. Future deploys keep them.

---

## Manual setup (no Blueprint)

If you'd rather click through the dashboard:

1. **New +** → **Web Service** → connect repo.
2. Settings:
   - **Runtime:** Node
   - **Plan:** Starter
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Environment variables:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (click *Generate*)
   - `ADMIN_EMAILS` = your email
   - `DATABASE_PATH` = `/var/data/cntrd.db`
   - `UPLOADS_PATH` = `/var/data/uploads`
4. **Disks** → add `cntrd-data`, mount path `/var/data`, size `1 GB`.
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
  doesn't, the Node version in `package.json` (engines.node) is pinned
  to a release that has matching prebuilds.
- **502 / "Application failed to respond"** — check the **Logs** tab.
  Most often a missing env var or a corrupted DB on the disk.
- **Disk-full errors** — bump the disk to 2 GB in the Blueprint or
  dashboard. The DB is small but uploaded avatars accumulate.

---

## Migrating off SQLite (if you ever outgrow it)

The whole storage layer goes through `database/db.js`. If you outgrow
SQLite, swap to Postgres in one place — the schema and queries are
standard SQL except for `datetime('now')` and a few `INSERT OR IGNORE`
shortcuts. Provision **Render Postgres** alongside the web service,
add a `DATABASE_URL` env var, and replace `better-sqlite3` with `pg`.
A few hours of work; not urgent until you have hundreds of active
users.

---

## What lives where in the repo

```
server.js              Express app + SPA fallback
database/db.js         SQLite + idempotent schema migrations
data/teams.js          Static team registry (server-side)
services/espn.js       ESPN scoreboards / teams / game detail / cache
routes/                REST API (auth, users, posts, plays, games,
                       teams, leagues, messages, pages, admin, upload)
middleware/auth.js     JWT bearer-token middleware
public/                Static SPA — index.html + js/cntrd/*.jsx
render.yaml            Render Blueprint (Starter + 1 GB disk)
```
