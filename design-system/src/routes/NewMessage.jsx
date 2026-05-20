import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Check } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Avatar, Pill } from '../components';
import { messages as msgsApi } from '../api';

export default function NewMessage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);   // [{ id, username, displayName }]
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);
  const tRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      try {
        const data = await msgsApi.searchUsers(q.trim());
        setResults(data.filter((u) => !picked.some((p) => p.id === u.id)));
      } catch { setResults([]); }
    }, 200);
    return () => tRef.current && clearTimeout(tRef.current);
  }, [q, picked]);

  const toggle = (u) => {
    setPicked((arr) => arr.some((p) => p.id === u.id) ? arr.filter((p) => p.id !== u.id) : [...arr, u]);
    setQ('');
    setResults([]);
  };

  const create = async () => {
    if (!picked.length) return;
    setCreating(true);
    setErr(null);
    try {
      const conv = await msgsApi.create(picked.map((p) => p.id));
      nav(`/messages/${conv.id}`, { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Eyebrow>New conversation</Eyebrow>
      <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 300, letterSpacing: '-0.03em', marginBottom: 24 }}>
        Pick <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>recipients</em>
      </h1>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {picked.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px',
                background: c.surface, border: `1px solid ${c.accent}`,
                color: c.accent, cursor: 'pointer',
                fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em',
              }}
            >
              @{u.username} <X size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4" style={{ borderBottom: `1px solid ${c.inkFaint}`, paddingBottom: 6 }}>
        <Search size={16} color={c.inkDim} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or name"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: fonts.body, fontSize: 16, color: c.ink, padding: '6px 0',
          }}
        />
      </div>

      <div style={{ maxWidth: 640 }}>
        {results.map((u) => {
          const initial = (u.displayName?.[0] || u.username?.[0] || '?').toUpperCase();
          return (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="flex items-center gap-3 py-3 w-full text-left"
              style={{ borderBottom: `1px solid ${c.line}`, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${c.line}` }}
            >
              <Avatar initial={initial} />
              <div className="flex-1">
                <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 500, color: c.ink }}>{u.displayName || u.username}</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>@{u.username}</div>
              </div>
              <Check size={16} color={c.inkDim} />
            </button>
          );
        })}
      </div>

      {err && <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, marginTop: 12 }}>{err}</div>}

      <button
        type="button"
        onClick={create}
        disabled={!picked.length || creating}
        style={{
          marginTop: 20,
          padding: '12px 18px',
          background: c.accent, color: c.paper, border: 'none',
          cursor: creating ? 'wait' : 'pointer',
          fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
          opacity: !picked.length || creating ? 0.5 : 1,
        }}
      >
        {creating ? 'Creating…' : `Start ${picked.length > 1 ? 'group' : 'conversation'}`}
      </button>
    </>
  );
}
