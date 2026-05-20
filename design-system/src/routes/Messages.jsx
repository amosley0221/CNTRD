import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, Avatar } from '../components';
import { messages as msgsApi } from '../api';

export default function Messages() {
  const [convs, setConvs] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await msgsApi.list();
        if (!cancel) setConvs(data || []);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <>
      <Eyebrow>Inbox</Eyebrow>
      <div className="flex justify-between items-baseline mb-6">
        <SectionHead title="Messages" italicWord={null} count={convs ? `${convs.length}` : '…'} />
        <Link
          to="/messages/new"
          style={{
            fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em',
            color: c.accent, textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> NEW
        </Link>
      </div>

      {err && <Errline msg={err} />}
      {!convs && !err && <Loading />}
      {convs && convs.length === 0 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>
          No conversations yet. <Link to="/messages/new" style={{ color: c.accent }}>Start one →</Link>
        </div>
      )}

      <div style={{ maxWidth: 640 }}>
        {convs?.map((conv) => <ConvRow key={conv.id} conv={conv} />)}
      </div>
    </>
  );
}

function ConvRow({ conv }) {
  const display = conv.is_group ? (conv.name || groupTitle(conv)) : (conv.other?.displayName || conv.other?.username || '—');
  const initial = (display[0] || '?').toUpperCase();
  const preview = conv.last_message?.content || (conv.last_message?.deleted ? '(deleted)' : '');
  const time = relTime(conv.last_message?.created_at || conv.last_message_at);

  return (
    <Link
      to={`/messages/${conv.id}`}
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: `1px solid ${c.line}`, color: 'inherit', textDecoration: 'none' }}
    >
      <Avatar initial={initial} />
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="flex justify-between items-baseline">
          <span style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em', color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display}
          </span>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.05em' }}>{time}</span>
        </div>
        <div style={{
          fontFamily: fonts.body, fontSize: 14,
          color: conv.unread > 0 ? c.ink : c.inkDim,
          fontWeight: conv.unread > 0 ? 500 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {preview || '—'}
        </div>
      </div>
      {conv.unread > 0 && (
        <span
          style={{
            fontFamily: fonts.mono, fontSize: 10, fontWeight: 700,
            color: c.paper, background: c.accent,
            borderRadius: 999, padding: '2px 8px', minWidth: 22, textAlign: 'center',
          }}
        >
          {conv.unread}
        </span>
      )}
    </Link>
  );
}

function groupTitle(conv) {
  const names = (conv.members || []).map((m) => m.displayName || m.username).slice(0, 3);
  return names.join(', ') + ((conv.members || []).length > 3 ? ` +${conv.members.length - 3}` : '');
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function Errline({ msg })   { return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>{msg}</div>; }
function Loading()          { return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>; }
