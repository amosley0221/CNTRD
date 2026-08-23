# CNTRD — Agent Brief

This file orients a Claude session on the CNTRD codebase. Read it once at
session start before making changes.

## What CNTRD is

Sports-only social network. Users sign in, post hot takes, drop 24h-expiring
Plays (photo / clip), DM each other, join live "Gameday" chat rooms tied to
a real game, react to posts and articles, watch live scoreboards. Backend
pulls scores/leaders/news from ESPN.

Production: `https://cntrd-618y.onrender.com` (Render, single dyno + 1 GB
persistent disk).

## Stack

- **Server.** Node 20, Express, JWT cookie auth, better-sqlite3 (SQLite file
  on Render's persistent disk at `/var/data/cntrd.db`). web-push for VAPID
  push notifications. No ORM — raw `db.prepare(...)` everywhere.
- **Frontend.** Two apps coexist on the same Express server:
  - **Legacy app at `/`** — React + JSX compiled in the browser via
    `@babel/standalone` (no bundler). Components attach to `window`. Lives
    in `public/js/cntrd/*.jsx`. Don't touch unless asked.
  - **v2 app at `/v2`** — Vite + React Router + Tailwind, real bundler. The
    rebuild we're shipping. Lives in `design-system/`. Output is committed
    to `public/v2/` so Render doesn't need to run Vite at deploy time.
- **External data.** ESPN's free site API (`site.api.espn.com`) via
  `services/espn.js`. Cached per-league in-memory.

## Repo layout

```
.
├── server.js                Express entry, route mounting, SPA fallbacks
├── package.json             Single root manifest (scripts: start, dev,
│                            dev:v2, build:v2)
├── render.yaml              Blueprint (autoDeploy from default branch)
├── database/
│   └── db.js                Schema (CREATE TABLE IF NOT EXISTS) +
│                            ensureColumn() for migrations
├── middleware/
│   └── auth.js              requireAuth, optionalAuth, setSessionCookie
├── routes/
│   ├── auth.js              /api/auth/{login,register,logout,me}
│   ├── posts.js             /api/posts (CRUD, like, repost, bookmark)
│   ├── plays.js             /api/plays (24h TTL, media)
│   ├── games.js             /api/games (live/recent), /:league/:id detail,
│   │                        /news/articles
│   ├── messages.js          /api/messages (DMs, groups, gameday rooms)
│   ├── notifications.js     /api/notifications
│   ├── push.js              /api/push (VAPID subscribe / test)
│   ├── articles.js          /api/articles (in-site reader + comments +
│   │                        reactions; id = sha256(url).slice(0, 16))
│   ├── upload.js            multipart media uploads (avatar/banner/media)
│   ├── users.js             /api/users/{username} + follow/block/mute
│   ├── search.js            /api/search?q=
│   ├── admin.js             owner-only debug + push diagnostics
│   └── ...
├── services/
│   ├── espn.js              getAll, getGameDetail, getNews, getAllTeams
│   ├── notifier.js          notify() helper + live-ticker + event-alert
│   └── push.js              VAPID key persistence, sendPushToUser()
├── design-system/           v2 source tree (Vite root)
│   ├── vite.config.js       outputs to ../public/v2/, base: '/v2/'
│   ├── tailwind.config.js   absolute content paths via fileURLToPath
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx         entry — mounts <App /> into #root
│       ├── App.jsx          BrowserRouter basename="/v2", route table
│       ├── tokens.js        Color + font tokens. Cream + terracotta
│       │                    palette. Change values here, every screen
│       │                    follows.
│       ├── styles.css       Tailwind directives + global cn-* keyframes
│       ├── api/             fetch wrapper + per-resource modules
│       ├── auth/            AuthContext (cntrd_session cookie)
│       ├── hooks/           useReveal (IntersectionObserver), CountUp
│       ├── components/      11 design-system components + index.js barrel
│       ├── routes/          one file per screen
│       └── Showcase.jsx     legacy showcase, mounted at /v2/_showcase
├── android/                 Android APK wrapper (WebView → live site)
│   ├── app/                 Android module
│   │   ├── build.gradle     minSdk 24, target 34, debug-signed
│   │   └── src/main/
│   │       ├── AndroidManifest.xml    permissions: INTERNET, CAMERA,
│   │       │                          RECORD_AUDIO
│   │       ├── java/com/cntrd/app/MainActivity.java  WebView host
│   │       └── res/                    icons + theme (cream + terracotta)
│   ├── build.gradle, settings.gradle, gradle.properties
│   └── README.md            install + build docs
└── public/
    ├── index.html           Legacy app shell
    ├── manifest.webmanifest start_url: "/" (NOT flipped to /v2 yet)
    ├── sw.js                Service worker — scoped to "/", covers /v2
    ├── icons/               PWA icons (180/192/512)
    ├── js/cntrd/*.jsx       Legacy app source
    ├── v2/                  Built v2 bundle (committed)
    └── uploads/              User media (ignored except .gitkeep)
```

## Architecture: two apps, same server

```
            ┌─────────────────────────────────────────┐
            │  Express server (server.js)             │
            │                                         │
   GET /  ──┼─► public/index.html (legacy SPA)        │
   GET /v2 ─┼─► public/v2/index.html (vite bundle)    │
   GET /v2/anything ─► /v2/* SPA fallback             │
   /api/*  ─► route modules                           │
   /uploads/* ─► multer's upload dir                  │
   /sw.js, /manifest.webmanifest ─► static            │
            └─────────────────────────────────────────┘
```

Both apps hit the **same `/api/*` endpoints** and share the **same cookie
session** (`cntrd_session`, HttpOnly, SameSite=Lax). Signing in on `/v2`
also signs you in on `/` and vice versa.

The v2 SPA fallback in `server.js`:

```js
app.get('/v2/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'v2', 'index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

The order matters — `/v2/*` is registered before the catch-all so React
Router's browser-history deep links (`/v2/feed`, `/v2/u/handle`, etc.)
serve the v2 shell instead of falling through to the legacy app.

## Scripts

```bash
npm start          # node server.js (production)
npm run dev        # nodemon server.js (server hot reload)
npm run dev:v2     # vite dev server with API proxy → :3000
npm run build:v2   # build the v2 bundle to public/v2/
```

### Android APK

The `android/` directory is a thin WebView wrapper around
`https://cntrd-618y.onrender.com/v2/feed`. GitHub Actions
(`.github/workflows/android-apk.yml`) builds it on every push to the
deploy branch that touches `android/**` and publishes the resulting
APK to the stable `android-latest` release tag. Users download from
https://github.com/amosley0221/CNTRD/releases/tag/android-latest.

Signing uses the standard Android debug config — fine for sideload,
Play Store would need a real keystore (see `android/README.md`).

For day-to-day v2 dev: `npm run dev` in one terminal, `npm run dev:v2` in
another. Vite serves the front-end on its own port with HMR; API calls
proxy to the Express server.

For production deploys: Render runs `npm install` then `npm start`. The
built v2 bundle is **already committed** to `public/v2/`, so Render
doesn't need to run Vite. Bump the bundle by running `npm run build:v2`
locally and committing the changed `public/v2/assets/*` files.

## v2 design system

The cream + terracotta palette lives in **one file** —
`design-system/src/tokens.js`. Change values there, every screen follows.

```js
export const c = {
  paper:    '#f4ede0',          // warm cream background
  surface:  '#ebe3d2',          // deeper cream for cards
  ink:      '#1a1612',          // warm near-black text
  inkSoft:  'rgba(26, 22, 18, 0.7)',
  inkDim:   'rgba(26, 22, 18, 0.5)',
  inkFaint: 'rgba(26, 22, 18, 0.18)',
  line:     'rgba(26, 22, 18, 0.15)',
  accent:   '#c84c1e',          // terracotta — primary accent
  alert:    '#8a1f2b',          // deep crimson — live / urgent
};

export const fonts = {
  display: '"Fraunces", Georgia, serif',
  body:    '"Instrument Sans", -apple-system, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
};
```

**Don't change the palette without explicit user direction.** Earlier in
the session we attempted a dark+volt-green swap from external mockups and
the user reverted it — they want cream + terracotta.

Components in `design-system/src/components/` use **inline styles** for
brand-specific values (custom hex colors, custom font stacks) and
**Tailwind** for layout, spacing, and standard utilities. Same pattern as
the original cntrd-react-components.tsx vision file.

## v2 routes

| Route | What | Auth |
|---|---|---|
| `/v2/login`, `/v2/register` | Auth screens | — |
| `/v2/feed` | Posts + games + plays rail + articles + live ticker + hero | required |
| `/v2/me`, `/v2/u/:username` | Profile with watermark + vitals | mixed |
| `/v2/me/edit` | Edit profile | required |
| `/v2/post/:id` | Post thread with replies | — |
| `/v2/compose` | New post composer (text + image) | required |
| `/v2/plays` | Plays grid (3:4 tiles) | — |
| `/v2/plays/new` | Camera + library creator (24h TTL, ≤30s clips) | required |
| `/v2/plays/:id` | Reels-style viewer (controls + side queue) | — |
| `/v2/messages` | Inbox | required |
| `/v2/messages/new` | User picker → start 1:1 or group | required |
| `/v2/messages/:id` | Thread (5s polling, bubble layout, closes_at) | required |
| `/v2/gameday` | Game picker for live chat rooms | required |
| `/v2/gameday/:gameId` | Resolves room → /messages/:id | required |
| `/v2/notifications` | Bell list + push subscribe / test | required |
| `/v2/search` | Live user + post search (debounced) | — |
| `/v2/game/:league/:id` | Game center (hero, by-period, plays, headlines) | — |
| `/v2/article/:id` | Article reader (reactions + comments) | mixed |
| `/v2/_showcase` | Original design system showcase | — |

Coming-soon stubs (still link to legacy): admin, account deletion, blocks list.

## Key conventions

### Database

- **Schema**: `CREATE TABLE IF NOT EXISTS` so adding a table auto-migrates.
- **Migrations**: column additions via `ensureColumn(table, col, ddl)`
  helper at the bottom of `db.js`. Idempotent.
- **IDs**: UUIDs (`uuid` package) for most rows. Article ids are
  `sha256(url).slice(0, 16)` so they're deterministic across clients.
- **No ORM** — raw `db.prepare(sql).run/all/get(...)`.

### Auth

- JWT signed at login with `JWT_SECRET` env, lives 30 days.
- Stored as **HttpOnly cookie** `cntrd_session`. Server-set, JS can't read
  it. The token is also returned in the JSON body for clients that prefer
  Bearer headers (legacy mobile-only).
- v2's `api/client.js` sends `credentials: 'same-origin'` on every request
  so the cookie flows automatically.
- `middleware/auth.js` exposes `requireAuth` (401 if no session),
  `optionalAuth` (decodes if present, `req.user = null` otherwise).

### Notifications + push

- Web Push via VAPID. Keys persisted in `app_settings` table (NOT the
  ephemeral file system — Render's container filesystem is wiped per
  deploy). See `services/push.js`.
- `services/notifier.js` has a one-place `notify()` helper that writes a
  notification row AND fans out a push to all of that user's subscriptions.
  Also dedupes — repeat events bump the existing row instead of creating
  new ones, but still trigger a fresh push.

### Articles

- External URL → deterministic ID via `sha256(url).slice(0, 16)`. Same hash
  on client and server (`design-system/src/routes/Feed.jsx` and
  `routes/articles.js` both use it).
- `POST /api/articles/resolve { url, league, title, ... }` is idempotent
  upsert. Client calls this when the row hasn't been created server-side.
- Reactions are `like` / `repost` / `bookmark`, toggled via
  `POST /api/articles/:id/react { kind }`.

### v2 Reveal animations

- `<Reveal>` from `hooks/useReveal.jsx` — IntersectionObserver-based fade +
  slide up on enter. Wrap big sections in it.
- `<CountUp value={X} />` — animated number that ticks 0 → value when
  scrolled into view. Used on profile vitals.
- **No GSAP dep.** IntersectionObserver is enough for the motion the
  mockups call for and saves ~70 KB raw.

## Common tasks

### Add an API endpoint

1. Add `router.<verb>('/path', ...handler)` to the relevant `routes/*.js`.
   Use `requireAuth` or `optionalAuth` as appropriate.
2. If new tables are needed, add `CREATE TABLE IF NOT EXISTS` to
   `database/db.js`.
3. Expose to the v2 client via a wrapper in
   `design-system/src/api/index.js`.

### Add a v2 screen

1. Create `design-system/src/routes/YourScreen.jsx`. Use `c` + `fonts`
   from tokens, import components from `../components`.
2. Register the route in `design-system/src/App.jsx` inside the `<Layout>`
   route. Wrap in `<RequireAuth>` if it needs a signed-in user.
3. Run `npm run build:v2` and commit `public/v2/index.html` +
   `public/v2/assets/*` along with the source.

### Bump the bundle hash after editing v2 source

`npm run build:v2` writes hashed asset filenames. The `public/v2/`
directory must be committed for the deploy to pick up changes. Two-step:

```
npm run build:v2
git add design-system/ public/v2/
```

## Important gotchas

- **Sandbox can't reach ESPN.** In the local sandbox, all
  `site.api.espn.com` requests return "Host not in allowlist". This means
  `/api/games`, `/api/games/news/articles`, and `/api/games/:league/:id`
  return empty (`{ live: [], upcoming: [], recent: [] }`) locally but work
  fine on Render. Don't waste time debugging "no data" locally.
- **Legacy PWA install on iOS.** `manifest.webmanifest` still has
  `start_url: "/"`. Existing iPhone home-screen installs open the legacy
  app. Switching to `/v2/feed` is a **one-line PR when you're ready** but
  changes the experience for everyone who already installed — wait until
  /v2 is verified.
- **iOS PWA viewport / home-indicator gap.** A persistent issue with the
  legacy app — see commit history around the "bottom nav gap" thread.
  Resolution was acknowledging the home-indicator zone is reserved by
  iOS and can't be filled by web content. Don't try to "fix" it again
  unless the user re-raises it.
- **PR merge conflicts on bundle hash.** Vite writes a content-hashed
  filename like `index-AbCdEfGh.js` on every build. When two feature
  branches both touch v2 source, their bundles get different hashes and
  `public/v2/index.html` references the wrong one. Resolution: take
  `--ours`, re-run `npm run build:v2`, commit. This has happened twice;
  see git log for the pattern.

## Branch + PR workflow

- The **default branch is `claude/implement-cntrd-design-ikHMT`** — this
  is the deploy target Render auto-deploys from.
- Feature branches: `feat/<short-name>` off the deploy branch.
- Open PRs via the GitHub MCP tool, base = `claude/implement-cntrd-design-ikHMT`.
- **Squash-merge** is standard so the deploy branch stays linear.
- Render `autoDeploy: true` triggers a new deploy on every push to the
  deploy branch. No manual deploy needed.
- After merging a PR, **fetch + rebase / branch fresh** before starting
  the next feature to avoid the bundle-hash conflict gotcha above.

## Things NOT to do

- **Don't change the palette** (`tokens.js` values). Already reverted once
  in-session; user wants cream + terracotta.
- **Don't touch `public/js/cntrd/*.jsx`** (legacy app) unless explicitly
  asked. It works; the path forward is migrating to /v2, not patching the
  legacy code.
- **Don't try to render ESPN article bodies in-site.** They have
  `X-Frame-Options: DENY` and we don't have rights to republish text.
  `/v2/article/:id` hosts the discussion; the body stays at ESPN.
- **Don't introduce a bundler for the legacy app.** It's intentionally
  build-step-free and that's what makes it survive.
- **Don't flip the manifest `start_url` to `/v2/feed` without confirmation.**
  Existing iPhone PWA installs would all redirect immediately.
- **Don't skip the `npm run build:v2` step** after editing v2 source —
  commits without the rebuilt bundle deploy stale code.

## When in doubt

The integration brief at `cntrd-integration-brief.md` and the mock files
on the `amosley0221-patch-1` branch
(`cntrd-component-and-profile.html`, `cntrd-enhanced.html`,
`cntrd-game-and-reel.html`, `cntrd-react-components.tsx`) describe the
design intent. **Note**: those mocks use a dark + volt-green palette
that the user **does not want** — port layout and component ideas from
them, not colors.
