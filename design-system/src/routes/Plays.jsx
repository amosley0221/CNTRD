import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, Avatar } from '../components';
import { plays as playsApi } from '../api';

export default function Plays() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await playsApi.list();
        if (!cancel) setItems(data || []);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <>
      <Eyebrow>Plays · last 24h</Eyebrow>
      <SectionHead title="The" italicWord="plays" count={items ? `${items.length}` : '…'} />

      {err && (
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, marginBottom: 12 }}>
          {err}
        </div>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
      >
        <Link
          to="/plays/new"
          aria-label="Add a play"
          style={{
            aspectRatio: '3 / 4',
            border: `1.5px dashed ${c.inkFaint}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, color: c.inkDim,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.inkFaint; e.currentTarget.style.color = c.inkDim; }}
        >
          <Plus size={32} strokeWidth={1.6} />
          <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em' }}>ADD</span>
        </Link>

        {items && items.length === 0 && (
          <div style={{ gridColumn: '2 / -1', fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '24px 0' }}>
            Nothing in the last 24 hours. Be the first.
          </div>
        )}

        {items && items.map((p) => <PlayTile key={p.id} play={p} />)}
      </div>
    </>
  );
}

function PlayTile({ play }) {
  const initial = (play.user?.displayName || play.user?.username || '?')[0]?.toUpperCase() || '?';
  return (
    <Link
      to={`/plays/${play.id}`}
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        overflow: 'hidden',
        background: c.surface,
        border: `1px solid ${c.line}`,
        color: c.paper,
        display: 'block',
      }}
    >
      {play.media_url ? (
        play.media_kind === 'video' ? (
          <video
            src={play.media_url}
            muted playsInline loop
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <img
            src={play.media_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        )
      ) : (
        <div style={{ width: '100%', height: '100%', background: `hsl(${play.hue}, 60%, 55%)` }} />
      )}

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.0) 55%, rgba(0,0,0,0.65) 100%)',
        display: 'flex', alignItems: 'flex-end', padding: 10,
      }}>
        <div className="flex items-center gap-2 w-full" style={{ minWidth: 0 }}>
          <Avatar initial={initial} />
          <div style={{ minWidth: 0, flex: 1, color: '#fff' }}>
            <div style={{ fontFamily: fonts.display, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {play.label}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 10, opacity: 0.85 }}>@{play.user?.username || 'anon'}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
