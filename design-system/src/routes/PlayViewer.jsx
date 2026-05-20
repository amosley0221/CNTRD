import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { c, fonts } from '../tokens';
import { plays as playsApi } from '../api';

export default function PlayViewer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const data = await playsApi.list().catch(() => []);
      if (cancel) return;
      setList(data);
      const found = data.findIndex((p) => p.id === id);
      setIdx(found >= 0 ? found : 0);
    })();
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    if (!list || !list[idx]) return;
    playsApi.view(list[idx].id).catch(() => {});
  }, [idx, list]);

  if (!list) {
    return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em', textAlign: 'center', padding: 80 }}>LOADING…</div>;
  }
  const play = list[idx];
  if (!play) {
    return <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, textAlign: 'center', padding: 40 }}>Play not found or expired.</div>;
  }

  const next = () => setIdx((i) => Math.min(i + 1, list.length - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <button onClick={() => nav('/plays')} aria-label="Close" style={ctrl({ top: 16, right: 16 })}>
        <X size={20} color="#fff" />
      </button>

      {idx > 0 && (
        <button onClick={prev} aria-label="Previous" style={ctrl({ top: '50%', left: 12, transform: 'translateY(-50%)' })}>
          <ChevronLeft size={22} color="#fff" />
        </button>
      )}
      {idx < list.length - 1 && (
        <button onClick={next} aria-label="Next" style={ctrl({ top: '50%', right: 12, transform: 'translateY(-50%)' })}>
          <ChevronRight size={22} color="#fff" />
        </button>
      )}

      <div style={{ position: 'relative', width: '100%', maxWidth: 460, aspectRatio: '9 / 16', background: '#111' }}>
        {play.media_url ? (
          play.media_kind === 'video' ? (
            <video
              key={play.id}
              src={play.media_url}
              autoPlay muted={false} playsInline controls loop
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          ) : (
            <img
              src={play.media_url}
              alt={play.label}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          )
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `hsl(${play.hue}, 60%, 50%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: fonts.display, fontSize: 56, fontWeight: 300, letterSpacing: '-0.04em', padding: 24, textAlign: 'center',
          }}>
            {play.label}
          </div>
        )}

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          padding: '24px 18px 18px',
          color: '#fff',
        }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.accent, marginBottom: 4 }}>
            @{play.user?.username || 'anon'} · {relTime(play.created_at)}
          </div>
          <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {play.label}
          </div>
          {play.caption && (
            <div style={{ fontFamily: fonts.body, fontSize: 14, opacity: 0.85, marginTop: 6 }}>{play.caption}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ctrl(extra) {
  return {
    position: 'absolute',
    width: 40, height: 40, borderRadius: 999,
    background: 'rgba(0,0,0,0.55)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 70,
    ...extra,
  };
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return `${Math.max(1, Math.round(diff))}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}
