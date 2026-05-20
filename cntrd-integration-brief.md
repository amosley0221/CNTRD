# Cntrd Design System Integration Brief

> A spec for Claude Code. Read this top-to-bottom before making any edits.

## What this is

A new design system has been built for the Cntrd sports app outside of this codebase. Your job is to integrate it: add the token file, add nine reusable components, and refactor any existing UI that overlaps so the new system becomes the source of truth.

The system is built around three ideas:

1. **One token file** — all colors and fonts live in a single `tokens.js` module. Every component imports from it. To rebrand or theme later, only the token file changes.
1. **Nine reusable components** — covering most sports-app UI surface area (game cards, posts, stats, headers).
1. **Light cream + terracotta palette** — warm, editorial, print-journalism mood. Replaces whatever palette currently exists.

This is a React + Tailwind codebase. Components use inline styles for brand-specific values (custom hex colors, custom font stacks) and Tailwind for layout, spacing, and standard utilities.

-----

## Ground rules

- **Create a feature branch.** Do not commit directly to `main` / `master` / `develop` or whatever the default branch is named. Name the branch `feat/design-system-v2` or similar.
- **Discover before editing.** Run `ls`, `find`, `cat package.json`, etc. to understand the repo structure before making changes.
- **Match existing code style.** If the project uses TypeScript, port the components to `.tsx` and add types. If it uses single quotes, match it. If it uses a specific import-sorting convention, follow it.
- **Don’t touch unrelated files.** Pages, hooks, API logic, tests for unrelated features — leave alone unless you find them actively conflicting with the design system.
- **Open a PR at the end.** Include a summary of changes, the before/after of any refactored screen, and a list of any decisions you made on your own.
- **Ask before destructive changes.** If you’re about to delete >50 lines of existing component code, or delete a whole file, surface that decision instead of making it silently.

-----

## Step 1 — Install dependencies

```bash
npm install lucide-react recharts
```

If the project uses yarn or pnpm, use that instead. Check `package-lock.json` vs `yarn.lock` vs `pnpm-lock.yaml` to determine.

-----

## Step 2 — Create the token file

Path: `src/design/tokens.js` (or `tokens.ts` if TypeScript). If `src/design/` doesn’t exist, create it. If the project uses a different conventional path (`src/lib/`, `src/styles/`, `app/_lib/`), use that instead.

```js
/* ============================================================
   COLOR TOKENS — single source of truth for the palette.
   Change these and the whole product shifts.
   ============================================================ */
export const c = {
  paper:    '#f4ede0',          // warm cream background
  surface:  '#ebe3d2',          // slightly deeper cream for cards
  ink:      '#1a1612',          // warm near-black text
  inkSoft:  'rgba(26, 22, 18, 0.7)',
  inkDim:   'rgba(26, 22, 18, 0.5)',
  inkFaint: 'rgba(26, 22, 18, 0.18)',
  line:     'rgba(26, 22, 18, 0.15)',
  accent:   '#c84c1e',          // terracotta — primary accent
  alert:    '#8a1f2b',          // deep crimson — live / urgent
};

/* Font stacks used throughout the design system */
export const fonts = {
  display: '"Fraunces", Georgia, serif',
  body:    '"Instrument Sans", -apple-system, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
};
```

Also load the Google Fonts. Add this `<link>` to the root `index.html` (Vite/CRA) or to the root layout (Next.js `app/layout.tsx`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

-----

## Step 3 — Add the nine components

Path: `src/design/components/`. One file per component. Each is a default export. Components import tokens from `../tokens`.

### 3.1 — `Logo.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function Logo({ className = 'text-2xl' }) {
  return (
    <span className={className} style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '-0.04em' }}>
      cntrd<span style={{ color: c.accent }}>.</span>
    </span>
  );
}
```

### 3.2 — `Eyebrow.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-3 mb-6" style={{ color: c.accent }}>
      <span className="block w-8 h-px" style={{ background: c.accent }} />
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}
```

### 3.3 — `SectionHead.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function SectionHead({ title, italicWord, count }) {
  return (
    <div className="flex justify-between items-baseline mb-8">
      <h2 style={{ fontFamily: fonts.display, fontWeight: 400, fontSize: 'clamp(26px, 5.5vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {title}{' '}
        {italicWord && <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>{italicWord}</em>}
      </h2>
      {count && (
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.15em' }}>
          {count}
        </span>
      )}
    </div>
  );
}
```

### 3.4 — `Pill.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function Pill({ children, primary, onClick, active }) {
  const isActive = primary || active;
  return (
    <button
      onClick={onClick}
      className="transition-all duration-200 cursor-pointer"
      style={{
        fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em',
        textTransform: 'uppercase', padding: '8px 14px',
        border: `1px solid ${isActive ? c.accent : c.inkFaint}`,
        color: isActive ? c.accent : c.ink, background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isActive ? c.accent : c.inkFaint; e.currentTarget.style.color = isActive ? c.accent : c.ink; }}
    >
      {children}
    </button>
  );
}
```

### 3.5 — `TeamMark.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function TeamMark({ code, color, size = 26 }) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 2,
        background: color, color: c.paper,
        fontFamily: fonts.mono, fontSize: size < 30 ? 10 : 14, fontWeight: 700,
      }}
    >
      {code}
    </span>
  );
}
```

### 3.6 — `Avatar.jsx`

```jsx
import { c, fonts } from '../tokens';

export default function Avatar({ initial }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 32, height: 32, background: c.surface,
        border: `1px solid ${c.line}`,
        fontFamily: fonts.display, fontWeight: 600, fontSize: 13, color: c.ink,
      }}
    >
      {initial}
    </div>
  );
}
```

### 3.7 — `LiveDot.jsx`

```jsx
import { c } from '../tokens';

export default function LiveDot({ tone = 'accent' }) {
  const color = tone === 'alert' ? c.alert : c.accent;
  return (
    <>
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: color, animation: 'cntrd-pulse 1.6s infinite' }}
      />
      <style>{`@keyframes cntrd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </>
  );
}
```

### 3.8 — `GameCard.jsx`

```jsx
import { c, fonts } from '../tokens';
import TeamMark from './TeamMark';
import LiveDot from './LiveDot';

export default function GameCard({ state, league, status, away, home, foot1, foot2 }) {
  const showOdds = state === 'UPCOMING';
  const statusColor = state === 'LIVE' ? c.accent : state === 'BREAK' ? c.alert : c.inkDim;

  return (
    <div
      className="relative p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: c.paper, border: `1px solid ${c.line}`, minHeight: 220 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.line)}
    >
      <span
        className="absolute"
        style={{
          top: -10, left: 18, background: c.paper, padding: '0 8px',
          fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.2em',
          color: c.accent, textTransform: 'uppercase',
        }}
      >
        STATE · {state}
      </span>

      <div className="flex justify-between items-center mb-5">
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim }}>{league}</span>
        <span className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em', color: statusColor }}>
          {(state === 'LIVE' || state === 'BREAK') && <LiveDot tone={state === 'BREAK' ? 'alert' : 'accent'} />}
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {[away, home].map((team, idx) => (
          <div key={idx} className="grid items-center gap-3" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <TeamMark code={team.code} color={team.color} />
            <span style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: team.lead ? c.ink : c.inkDim }}>
              {team.name}
            </span>
            <span style={{
              fontFamily: fonts.display,
              fontSize: showOdds ? 16 : 28,
              fontWeight: showOdds ? 400 : 300,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.04em',
              color: showOdds ? c.inkDim : (team.lead ? c.accent : c.inkDim),
            }}>
              {showOdds ? team.odds : team.score}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 flex justify-between"
        style={{ borderTop: `1px dashed ${c.line}`, fontFamily: fonts.mono, fontSize: 9.5, color: c.inkDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        <span>{foot1}</span>
        <span>{foot2}</span>
      </div>
    </div>
  );
}
```

**Props:** `state` (`'LIVE'` / `'FINAL'` / `'UPCOMING'` / `'BREAK'`), `league`, `status`, `away` and `home` (each: `{ code, color, name, score?, odds?, lead? }`), `foot1`, `foot2`.

### 3.9 — `StatBlock.jsx`

```jsx
import { useState, useEffect } from 'react';
import { c, fonts } from '../tokens';

export default function StatBlock({ value, unit, label, delta, deltaDirection = 'up', animate = true }) {
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) return;
    const target = parseFloat(value);
    const duration = 1400;
    const start = performance.now();
    let frame;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(eased * target);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  const display = Number.isInteger(parseFloat(value)) ? Math.round(shown) : shown.toFixed(1);
  const deltaColor = deltaDirection === 'down' ? c.alert : c.accent;

  return (
    <div className="flex flex-col gap-1.5">
      <div style={{
        fontFamily: fonts.display, fontWeight: 200,
        fontSize: 'clamp(48px, 10vw, 72px)', lineHeight: 0.9,
        letterSpacing: '-0.04em', color: c.ink, fontVariantNumeric: 'tabular-nums',
      }}>
        {display}
        {unit && <span style={{ fontSize: '0.4em', color: c.inkDim, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim, textTransform: 'uppercase' }}>
        {label}
      </div>
      {delta && (
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: deltaColor, letterSpacing: '0.05em' }}>
          {deltaDirection === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}
```

### 3.10 — `Post.jsx`

```jsx
import { useState } from 'react';
import { Heart, Repeat2, MessageCircle } from 'lucide-react';
import { c, fonts } from '../tokens';
import Avatar from './Avatar';

export default function Post({ author, handle, time, body, stats = { up: 0, repost: 0, reply: 0 } }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="py-6 flex flex-col gap-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-2.5">
        <Avatar initial={author[0]} />
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{author}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>{handle}</div>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
      </div>

      <div style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.35, fontWeight: 300, color: c.ink }}>
        {body}
      </div>

      <div className="flex gap-6 mt-1" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
        <button
          className="flex items-center gap-1.5 transition-colors duration-200"
          onClick={() => setLiked(!liked)}
          style={{ color: liked ? c.accent : c.inkDim }}
        >
          <Heart size={13} fill={liked ? c.accent : 'none'} />
          {(stats.up + (liked ? 1 : 0)).toLocaleString()}
        </button>
        <span className="flex items-center gap-1.5"><Repeat2 size={13} /> {stats.repost}</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={13} /> {stats.reply}</span>
      </div>
    </article>
  );
}
```

### 3.11 — `Header.jsx`

```jsx
import { useState, useEffect } from 'react';
import { c, fonts } from '../tokens';
import Logo from './Logo';
import LiveDot from './LiveDot';

export default function Header({ liveCount = 14 }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = clock.toLocaleDateString([], { weekday: 'short' }).toUpperCase();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{ background: c.paper + 'd9', borderBottom: `1px solid ${c.line}` }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 md:px-12">
        <Logo />
        <div className="flex items-center gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
          <span className="flex items-center gap-1.5" style={{ color: c.alert, textTransform: 'uppercase' }}>
            <LiveDot tone="alert" />{liveCount} LIVE
          </span>
          <span>{day} · {time}</span>
        </div>
      </div>
    </header>
  );
}
```

### 3.12 — Barrel export

Create `src/design/components/index.js` so consumers can import in one line:

```js
export { default as Logo } from './Logo';
export { default as Eyebrow } from './Eyebrow';
export { default as SectionHead } from './SectionHead';
export { default as Pill } from './Pill';
export { default as TeamMark } from './TeamMark';
export { default as Avatar } from './Avatar';
export { default as LiveDot } from './LiveDot';
export { default as GameCard } from './GameCard';
export { default as StatBlock } from './StatBlock';
export { default as Post } from './Post';
export { default as Header } from './Header';
```

Usage from anywhere in the app:

```jsx
import { GameCard, StatBlock, Post } from '@/design/components';
```

-----

## Step 4 — Refactor existing UI

Survey the existing codebase for anything overlapping. Likely candidates:

- **Existing header / nav bar** → replace with `<Header />`
- **Existing score widget / game tile** → replace with `<GameCard />`
- **Existing tweet / post component** → replace with `<Post />`
- **Existing big-stat display** → replace with `<StatBlock />`
- **Existing buttons** in the same style family → replace with `<Pill />`

**For each overlap:**

1. Identify the file and where it’s used.
1. Replace usage with the new component, mapping the old props to the new prop shape.
1. If the new component lacks a prop the old one needed, add the prop to the component (keep new props optional with defaults — don’t break other consumers).
1. Delete the old component file only if no other code imports it. Otherwise leave a deprecation comment at the top.

**Color refactor:** If the existing app has its own color constants (look for `colors.js`, `theme.js`, Tailwind config customizations, hardcoded hex values in JSX), don’t delete them yet. The new tokens live in their own file and don’t conflict. After PR review, a follow-up branch can migrate any remaining references.

-----

## Step 5 — Add a showcase route

Create a new route at `/design` (or `/_design`, or whatever pattern this project uses for internal routes) that renders all the components in one place. This is for QA — verifying the integration worked without having to navigate the full app.

The reference composition lives in the original artifact file (`cntrd-react-components.jsx`). Use that as a starting template. Strip out anything that doesn’t compile in this codebase.

If the project uses Next.js App Router: `app/design/page.jsx`.
If Pages Router: `pages/design.jsx`.
If Vite + React Router: add a route in the router config.

-----

## Step 6 — Verify

Run the dev server and walk through this checklist:

- [ ] `npm install` completed with no errors
- [ ] Fonts are loading (check Network tab for `fonts.googleapis.com` requests, then inspect any heading — `font-family` should resolve to `Fraunces`)
- [ ] `/design` route renders all components without console errors
- [ ] The `GameCard` shows the chartreuse-replacement (terracotta `#c84c1e`) on the winning team’s score
- [ ] The `LiveDot` pulses (animation is running)
- [ ] The `StatBlock` numbers count up from 0 on first render
- [ ] Clicking the heart icon on a `Post` toggles its color to terracotta
- [ ] The existing app’s main pages still render — no regressions from the refactor

Run lint and any test suite that exists: `npm run lint`, `npm test`, `npm run typecheck`. Fix anything that broke.

-----

## Step 7 — Open the PR

Push the branch and open a pull request with this template:

```
## Design System v2 — Integration

Introduces a token-driven design system for the app. Single token file
controls colors and fonts across the product.

### Added
- `src/design/tokens.js` — color and font tokens
- `src/design/components/` — 11 reusable components
- `/design` showcase route for QA

### Refactored
- [list each existing component that was replaced]

### Dependencies
- lucide-react
- recharts

### Notes
- Token file controls the whole palette. To re-theme, edit `tokens.js`.
- Old color constants in `[existing file]` left in place; suggest follow-up
  PR to migrate remaining references.

### Verification
- [ ] All existing pages render
- [ ] `/design` route shows all components
- [ ] Lint and tests pass
```

-----

## Notes for the future

- **Theme variants.** The token file is structured to support multiple themes. Convert `c` and `fonts` to a `themes` object with `light` / `dark` variants, then pass via React context. Components can stay the same — they read from context instead of importing directly.
- **TypeScript types.** If the project is TS, add a `types.ts` next to the token file exporting `Theme`, `GameState`, `TeamData`, `PostStats` etc. so the component prop shapes are formal.
- **Storybook.** If the project has Storybook, write a `.stories.jsx` for each component. The `/design` showcase route is a good seed for what each story should cover.

If anything in this brief is ambiguous or conflicts with existing project conventions, ask before proceeding rather than guessing.