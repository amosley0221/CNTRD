import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
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

  if (!list) return <Center>LOADING…</Center>;
  const play = list[idx];
  if (!play) return <Center>Play not found or expired.</Center>;

  const next = () => setIdx((i) => Math.min(i + 1, list.length - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
      <button onClick={() => nav('/plays')} aria-label="Close" style={ctrl({ top: 16, right: 16 })}>
        <X size={20} color="#fff" />
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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

        <PlayStage play={play} onEnded={next} />
      </div>

      {/* QUEUE — horizontally scrollable strip of the next plays */}
      <Queue list={list} idx={idx} onPick={setIdx} />
    </div>
  );
}

function PlayStage({ play, onEnded }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isVideo = play.media_kind === 'video';

  useEffect(() => {
    setTime(0); setDuration(0); setPlaying(true);
  }, [play.id]);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e) => {
    const v = ref.current;
    if (!v || !duration) return;
    const bar = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - bar.left) / bar.width));
    v.currentTime = pct * duration;
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 460, aspectRatio: '9 / 16', background: '#111', overflow: 'hidden' }}>
      {/* Title overlay */}
      <div style={{ position: 'absolute', top: 16, left: 18, right: 18, zIndex: 3, color: '#fff' }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.accent, textTransform: 'uppercase' }}>
          @{play.user?.username || 'anon'} · {relTime(play.created_at)}
        </div>
        <div className="fraunces-soft" style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, marginTop: 4, maxWidth: '76%' }}>
          {play.label}
        </div>
      </div>

      {play.media_url ? (
        isVideo ? (
          <video
            ref={ref}
            src={play.media_url}
            autoPlay
            muted={muted}
            playsInline
            loop={false}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onEnded={() => { setPlaying(false); onEnded?.(); }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <img src={play.media_url} alt={play.label} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
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

      {/* Custom controls bar */}
      {isVideo && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: '14px 18px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.65) 50%)',
            display: 'flex', flexDirection: 'column', gap: 10,
            zIndex: 4, color: '#fff',
          }}
        >
          <div onClick={seek} style={{ height: 4, background: 'rgba(255,255,255,0.25)', position: 'relative', cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: duration ? `${(time / duration) * 100}%` : 0, background: c.accent }}>
              <span style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: 999, background: c.accent }} />
            </div>
          </div>
          <div className="flex items-center justify-between" style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em' }}>
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} style={iconBtn}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={() => setMuted((m) => !m)} aria-label="Toggle mute" style={iconBtn}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(time)} / {fmtTime(duration)}</span>
            <button onClick={() => ref.current?.requestFullscreen?.()} aria-label="Fullscreen" style={iconBtn}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Queue({ list, idx, onPick }) {
  if (!list?.length) return null;
  return (
    <div
      style={{
        flex: '0 0 auto',
        background: 'rgba(0,0,0,0.85)', borderTop: `1px solid ${c.line}`,
        padding: '14px 16px 18px',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.accent, marginBottom: 10, textTransform: 'uppercase' }}>
        UP NEXT
      </div>
      <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
        {list.map((p, i) => {
          const active = i === idx;
          return (
            <button
              key={p.id}
              onClick={() => onPick(i)}
              style={{
                flex: '0 0 130px',
                aspectRatio: '9 / 16',
                background: '#000',
                border: `1px solid ${active ? c.accent : c.line}`,
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
                overflow: 'hidden',
                color: '#fff',
              }}
            >
              {p.media_url ? (
                p.media_kind === 'video' ? (
                  <video src={p.media_url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={p.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ width: '100%', height: '100%', background: `hsl(${p.hue}, 60%, 55%)` }} />
              )}
              <div style={{
                position: 'absolute', top: 6, left: 8,
                fontFamily: fonts.mono, fontSize: 9, color: active ? c.accent : '#fff',
                letterSpacing: '0.15em', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                padding: '6px 8px', fontFamily: fonts.mono, fontSize: 9, color: '#fff', letterSpacing: '0.05em',
              }}>
                @{p.user?.username || 'anon'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em' }}>
      {children}
    </div>
  );
}

const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#fff', padding: 0, display: 'inline-flex', alignItems: 'center',
};

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

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
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
