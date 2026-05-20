import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Avatar, LiveDot } from '../components';
import { messages as msgsApi } from '../api';
import { useAuth } from '../auth/AuthContext';

const POLL_MS = 5000;

export default function Thread() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const [conv, setConv] = useState(null);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const scrollerRef = useRef(null);
  const lastSeenIdRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    let timer = null;

    const load = async () => {
      try {
        const [convData, msgs] = await Promise.all([
          msgsApi.conversation(id),
          msgsApi.fetch(id),
        ]);
        if (cancel) return;
        setConv(convData);
        setItems(msgs);
        lastSeenIdRef.current = msgs[msgs.length - 1]?.id || null;
        requestAnimationFrame(() => {
          if (scrollerRef.current) {
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
          }
        });
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    };

    const poll = async () => {
      try {
        const after = items[items.length - 1]?.created_at;
        if (!after) return;
        const fresh = await msgsApi.fetch(id, { after });
        if (cancel || !fresh?.length) return;
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of fresh) if (!seen.has(m.id)) merged.push(m);
          return merged;
        });
        requestAnimationFrame(() => {
          if (scrollerRef.current) {
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
          }
        });
      } catch { /* tolerate */ }
    };

    load();
    timer = setInterval(poll, POLL_MS);
    return () => { cancel = true; if (timer) clearInterval(timer); };
  }, [id]);   // eslint-disable-line

  const send = async (e) => {
    e?.preventDefault?.();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setErr(null);
    try {
      await msgsApi.send(id, content);
      setDraft('');
      const fresh = await msgsApi.fetch(id);
      setItems(fresh);
      requestAnimationFrame(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const title = conv?.is_group
    ? (conv.name || (conv.members || []).map((m) => m.displayName || m.username).join(', '))
    : (conv?.other?.displayName || conv?.other?.username || 'Direct message');
  const isGameday = !!conv?.game_id;
  const closed = !!conv?.closes_at && Date.parse(conv.closes_at) < Date.now();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => nav(isGameday ? '/gameday' : '/messages')}
          aria-label="Back"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.inkDim }}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {isGameday && (
            <div className="flex items-center gap-1.5" style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: closed ? c.inkDim : c.alert }}>
              {!closed && <LiveDot tone="alert" />}
              {closed ? 'CHAT CLOSED' : 'GAMEDAY LIVE'}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        style={{
          flex: 1, overflowY: 'auto',
          border: `1px solid ${c.line}`,
          padding: '14px 14px 16px',
          background: c.paper,
          minHeight: 360, maxHeight: '60vh',
        }}
      >
        {err && <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, marginBottom: 8 }}>{err}</div>}
        {items.map((m) => (
          <MessageBubble key={m.id} m={m} mine={m.user.id === me?.id} />
        ))}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 mt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={closed ? 'Chat closed' : 'Type a message…'}
          disabled={closed || sending}
          style={{
            flex: 1, padding: '12px 14px',
            background: 'transparent',
            border: `1px solid ${c.inkFaint}`,
            color: c.ink, fontFamily: fonts.body, fontSize: 15, outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = c.accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={closed || sending || !draft.trim()}
          style={{
            padding: '10px 14px',
            background: c.accent, color: c.paper,
            border: 'none', cursor: sending ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            opacity: closed || sending || !draft.trim() ? 0.4 : 1,
          }}
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ m, mine }) {
  if (m.is_system) {
    return (
      <div style={{ textAlign: 'center', margin: '8px 0', fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.15em' }}>
        {m.content || ''}
      </div>
    );
  }
  const initial = (m.user.displayName?.[0] || m.user.username?.[0] || '?').toUpperCase();
  return (
    <div className={`flex gap-2 mb-3 ${mine ? 'flex-row-reverse' : ''}`} style={{ alignItems: 'flex-end' }}>
      {!mine && <Avatar initial={initial} />}
      <div style={{ maxWidth: '74%' }}>
        {!mine && (
          <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, marginBottom: 2, letterSpacing: '0.05em' }}>
            @{m.user.username}
          </div>
        )}
        <div
          style={{
            background: mine ? c.accent : c.surface,
            color: mine ? c.paper : c.ink,
            padding: '8px 12px',
            borderRadius: 14,
            fontFamily: fonts.body, fontSize: 15, lineHeight: 1.4,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: mine ? 'none' : `1px solid ${c.line}`,
          }}
        >
          {m.deleted ? <em style={{ opacity: 0.6 }}>message removed</em> : m.content}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, color: c.inkDim, marginTop: 3, textAlign: mine ? 'right' : 'left', letterSpacing: '0.05em' }}>
          {relTime(m.created_at)}
        </div>
      </div>
    </div>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
