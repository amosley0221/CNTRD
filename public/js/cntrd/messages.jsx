// messages.jsx — DMs and group chats.
// Three screens stacked into one navigable flow:
//   MessagesScreen   → list of conversations
//   ConversationScreen → view + send messages in a thread
//   NewConversationScreen → search users, pick, name (group), create

// Convention: app passes a `messageContext` prop = { selectedId, mode }.
// `mode` is 'list' | 'thread' | 'new'.

function MessagesRoot({ tweaks, onNav, me, messageContext, setMessageContext, onUnread, unreadMessages = 0 }) {
  const ctx = messageContext || { mode: 'list' };
  if (ctx.mode === 'new') {
    return <NewConversationScreen
      onNav={onNav} me={me}
      onCreated={(conv) => setMessageContext?.({ mode: 'thread', selectedId: conv.id })}
      onCancel={() => setMessageContext?.({ mode: 'list' })}
    />;
  }
  if (ctx.mode === 'thread' && ctx.selectedId) {
    return <ConversationScreen
      onNav={onNav} me={me} conversationId={ctx.selectedId}
      onBack={() => setMessageContext?.({ mode: 'list' })}
      onUnread={onUnread}
    />;
  }
  return <MessagesListScreen
    onNav={onNav} me={me}
    unreadMessages={unreadMessages}
    onOpenThread={(id) => setMessageContext?.({ mode: 'thread', selectedId: id })}
    onCompose={() => setMessageContext?.({ mode: 'new' })}
    onUnread={onUnread}
  />;
}

// ─── List of conversations ────────────────────────────────────────────
function MessagesListScreen({ onNav, me, onOpenThread, onCompose, onUnread, unreadMessages = 0 }) {
  const [convs, setConvs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const list = await API.conversations();
      setConvs(list);
      onUnread?.((list || []).reduce((n, c) => n + (c.unread || 0), 0));
    } catch (e) {
      setErr(e.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [onUnread]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <ScreenTopBar
        title="MESSAGES"
        onBack={() => onNav?.('back')}
        right={
          <button onClick={onCompose} style={{
            padding: '6px 12px', borderRadius: 999,
            background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
            border: 'none', fontWeight: 700, fontSize: 12,
            cursor: 'pointer', fontFamily: 'var(--cn-font-body)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="plus" size={14} stroke="var(--cn-on-accent)" sw={2.4} /> New
          </button>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {loading ? <Empty>Loading…</Empty>
          : err ? <Empty danger>{err}</Empty>
          : convs.length === 0 ? <EmptyState onCompose={onCompose} />
          : convs.map(c => <ConversationRow key={c.id} conv={c} me={me} onClick={() => onOpenThread(c.id)} />)}
      </div>
      <BottomNav active="messages" onChange={onNav} unreadMessages={unreadMessages} />
    </div>
  );
}

function EmptyState({ onCompose }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12, lineHeight: 1.6 }}>
      No conversations yet.<br />
      <button onClick={onCompose} style={{
        marginTop: 12, padding: '8px 16px', borderRadius: 999,
        background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
        border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        fontFamily: 'var(--cn-font-body)',
      }}>Start one</button>
    </div>
  );
}

function ConversationRow({ conv, me, onClick }) {
  const title = conversationTitle(conv, me);
  const subtitle = conv.last_message?.content || (conv.is_group ? `${conv.members.length} people` : '');
  const previewSender = conv.last_message
    ? (conv.last_message.user_id === me?.id ? 'You: ' : '')
    : '';
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
      cursor: 'pointer',
      background: conv.unread > 0 ? 'color-mix(in srgb, var(--cn-accent) 6%, transparent)' : 'transparent',
    }}>
      <ConversationAvatar conv={conv} me={me} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>
            {conv.last_message_at ? relTime(conv.last_message_at) : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontSize: 12, color: 'var(--cn-text-dim)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>{previewSender}{subtitle}</span>
          {conv.unread > 0 && <UnreadBadge n={conv.unread} />}
        </div>
      </div>
    </div>
  );
}

function UnreadBadge({ n }) {
  return (
    <span style={{
      padding: '0 6px', minWidth: 18, height: 18,
      borderRadius: 999, background: 'var(--cn-accent)',
      color: 'var(--cn-on-accent)',
      fontFamily: 'var(--cn-font-mono)', fontSize: 10, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{n > 99 ? '99+' : n}</span>
  );
}

function ConversationAvatar({ conv, me, size = 36 }) {
  if (!conv.is_group && conv.other) return <Avatar user={conv.other} size={size} />;
  // Group: stack of two avatars
  const first = conv.members.find(m => m.id !== me?.id) || conv.members[0];
  const second = conv.members.find(m => m.id !== me?.id && m.id !== first?.id);
  if (!first) return <div style={{ width: size, height: size }} />;
  const ringSize = size;
  const innerSize = Math.round(size * 0.7);
  return (
    <div style={{ width: ringSize, height: ringSize, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Avatar user={first} size={innerSize} />
      </div>
      {second && (
        <div style={{ position: 'absolute', right: 0, bottom: 0, boxShadow: '0 0 0 2px var(--cn-bg)', borderRadius: '50%' }}>
          <Avatar user={second} size={innerSize} />
        </div>
      )}
    </div>
  );
}

function conversationTitle(conv, me) {
  if (conv.is_group) {
    return conv.name || conv.members.filter(m => m.id !== me?.id).map(m => m.displayName).slice(0, 3).join(', ') + (conv.members.length > 4 ? ' +' : '');
  }
  return conv.other?.displayName || 'Conversation';
}

// ─── Single thread ────────────────────────────────────────────────────
function ConversationScreen({ onNav, me, conversationId, onBack, onUnread }) {
  const [conv, setConv] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [eventOpen, setEventOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [err, setErr] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const [replyTo, setReplyTo] = React.useState(null);
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const load = React.useCallback(async () => {
    try {
      const [c, ms] = await Promise.all([
        API.conversation(conversationId),
        API.conversationMessages(conversationId),
      ]);
      setConv(c);
      setMessages(ms);
      onUnread?.(0);            // we just opened it; clear unread badge optimistically
      // Group events live alongside messages — load only for groups.
      if (c?.is_group) {
        try {
          const evs = await API.conversationEvents(conversationId);
          setEvents(evs || []);
        } catch { /* ignore */ }
      } else {
        setEvents([]);
      }
    } catch (e) {
      setErr(e.message || 'Failed to load');
    }
  }, [conversationId, onUnread]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Scroll to bottom when messages change.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const replyId = replyTo?.id || null;
    setReplyTo(null);
    try {
      const m = await API.sendMessage(conversationId, text, replyId);
      setMessages(prev => [...prev, m]);
    } catch (e) {
      setErr(e.message || 'Failed to send');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const saveName = async () => {
    const newName = nameDraft.trim();
    try {
      const updated = await API.renameConversation(conversationId, newName);
      setConv(updated);
      setRenaming(false);
    } catch (e) {
      setErr(e.message || 'Rename failed');
    }
  };

  if (!conv) return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <ScreenTopBar title="MESSAGE" onBack={onBack} />
      <Empty>{err || 'Loading…'}</Empty>
    </div>
  );

  const title = conversationTitle(conv, me);
  const subtitle = conv.is_group
    ? `${conv.members.length} people · ${conv.members.map(m => '@' + m.username).slice(0, 4).join(', ')}${conv.members.length > 4 ? '…' : ''}`
    : conv.other ? '@' + conv.other.username : '';

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={onBack}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <ConversationAvatar conv={conv} me={me} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Group name"
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 6,
                  background: 'var(--cn-bg-elev)',
                  border: '0.5px solid var(--cn-border-s)',
                  color: 'var(--cn-text)', fontSize: 13,
                  outline: 'none', fontFamily: 'var(--cn-font-body)',
                }}
              />
              <button onClick={saveName} style={ghostMiniBtn('var(--cn-accent)')}>Save</button>
              <button onClick={() => setRenaming(false)} style={ghostMiniBtn('var(--cn-text-mute)')}>×</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                {conv.is_group && (
                  <button onClick={() => { setRenaming(true); setNameDraft(conv.name || ''); }} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--cn-text-mute)', padding: 0, display: 'flex',
                  }} title="Rename group">
                    <Icon name="text" size={14} />
                  </button>
                )}
              </div>
              <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
            </>
          )}
        </div>
        {conv.is_group && (
          <button onClick={() => setEventOpen(true)} title="Schedule an event" style={{
            padding: '6px 10px', borderRadius: 999,
            background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
            border: 'none', cursor: 'pointer',
            fontFamily: 'var(--cn-font-body)', fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="plus" size={12} stroke="var(--cn-on-accent)" sw={2.4} />
            Event
          </button>
        )}
      </div>

      {conv.is_group && events.length > 0 && (
        <EventStrip
          events={events}
          me={me}
          onCancel={async (eventId) => {
            try {
              await API.deleteEvent(conversationId, eventId);
              setEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (e) { alert(e.message || 'Could not cancel'); }
          }}
        />
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, padding: 24 }}>
            Say hi — this conversation is empty.
          </div>
        ) : messages.map((m, i) => {
          const mine = m.user.id === me?.id;
          const prev = messages[i - 1];
          const showAuthor = !mine && (!prev || prev.user.id !== m.user.id);
          return <MessageBubble key={m.id} m={m} mine={mine} showAuthor={showAuthor && conv.is_group} onReply={() => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 0); }} />;
        })}
      </div>

      {replyTo && (
        <div style={{
          padding: '8px 12px', borderTop: '0.5px solid var(--cn-border-s)',
          background: 'var(--cn-bg-elev2)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--cn-accent)', borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>
              REPLYING TO @{replyTo.user.username}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--cn-text-dim)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{replyTo.content}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
          }} title="Cancel reply">
            <Icon name="x" size={16} stroke="var(--cn-text-dim)" />
          </button>
        </div>
      )}

      <div style={{
        padding: '10px 12px 14px',
        borderTop: '0.5px solid var(--cn-border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--cn-bg-elev2)',
      }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={replyTo ? `Reply to @${replyTo.user.username}` : 'Message…'}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 999,
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border-s)',
            color: 'var(--cn-text)', fontSize: 13,
            outline: 'none', fontFamily: 'var(--cn-font-body)',
          }}
        />
        <button onClick={send} disabled={!draft.trim() || sending} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: draft.trim() && !sending ? 'var(--cn-accent)' : 'var(--cn-bg-elev)',
          color: draft.trim() && !sending ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
          border: '0.5px solid var(--cn-border-s)',
          cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="send" size={16} stroke="currentColor" />
        </button>
      </div>
      {eventOpen && (
        <EventScheduleModal
          onClose={() => setEventOpen(false)}
          onCreate={async ({ title, description, start_at }) => {
            try {
              const ev = await API.createEvent(conversationId, { title, description, start_at });
              setEvents(prev => [...prev, ev].sort((a, b) => a.start_at < b.start_at ? -1 : 1));
              setEventOpen(false);
            } catch (e) { alert(e.message || 'Could not create'); }
          }}
        />
      )}
    </div>
  );
}

// ─── Group event helpers ──────────────────────────────────────────────
function parseSqliteDate(s) {
  if (!s) return null;
  // Stored as "YYYY-MM-DD HH:MM:SS" UTC; ensure JS parses it as UTC.
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}
function formatEventTime(s) {
  const d = parseSqliteDate(s);
  if (!d) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function relStartTime(s) {
  const d = parseSqliteDate(s);
  if (!d) return '';
  const diff = d.getTime() - Date.now();
  if (diff < 0) {
    const past = Math.abs(diff);
    if (past < 60_000) return 'started just now';
    if (past < 3_600_000) return `started ${Math.floor(past / 60_000)}m ago`;
    return 'started';
  }
  if (diff < 60_000) return 'starts in <1m';
  if (diff < 3_600_000) return `starts in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `starts in ${Math.floor(diff / 3_600_000)}h`;
  return `starts ${formatEventTime(s)}`;
}

function EventStrip({ events, me, onCancel }) {
  const [now, setNow] = React.useState(Date.now());
  // Tick every 30s so the relative "starts in X" label stays fresh.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  // Hide events that ended >2h ago — keep recent ones around briefly so
  // the "in progress" indicator has a chance to surface.
  const visible = events.filter(e => {
    const d = parseSqliteDate(e.start_at);
    return d && (d.getTime() > now - 2 * 3600_000);
  });
  if (!visible.length) return null;
  return (
    <div style={{
      borderBottom: '0.5px solid var(--cn-border)',
      background: 'color-mix(in srgb, var(--cn-accent) 6%, var(--cn-bg-elev))',
      padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {visible.map(ev => {
        const d = parseSqliteDate(ev.start_at);
        const diff = d ? d.getTime() - now : 0;
        const live = diff <= 0;
        const canCancel = !!me && (ev.created_by === me.id || true);  // any member can dismiss
        return (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: live ? 'var(--cn-live)' : 'var(--cn-accent)',
              color: 'var(--cn-on-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, flexShrink: 0,
            }} aria-hidden>📅</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                {live && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 4,
                    background: 'var(--cn-live)', color: '#fff',
                    fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                  }}>LIVE</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>
                {formatEventTime(ev.start_at)} · {relStartTime(ev.start_at)}
              </div>
              {ev.description && (
                <div style={{ fontSize: 12, color: 'var(--cn-text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.description}
                </div>
              )}
            </div>
            {canCancel && (
              <button
                onClick={async () => {
                  const ok = await confirmAction({
                    title: `Cancel "${ev.title}"?`,
                    message: 'The event will disappear for everyone in the group.',
                    confirmLabel: 'Cancel event',
                    danger: true,
                  });
                  if (!ok) return;
                  onCancel?.(ev.id);
                }}
                title="Cancel event"
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--cn-text-mute)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="x" size={14} sw={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function defaultStartIso(offsetMin = 60) {
  // Round up to the next quarter hour, then pad by offsetMin.
  const d = new Date(Date.now() + offsetMin * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + ((15 - (d.getMinutes() % 15)) % 15));
  // datetime-local needs YYYY-MM-DDTHH:MM in *local* time.
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventScheduleModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [startLocal, setStartLocal] = React.useState(() => defaultStartIso(60));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const submit = async () => {
    if (!title.trim() || !startLocal || busy) return;
    setBusy(true); setErr(null);
    try {
      // Convert the local datetime-local value to a UTC ISO string the
      // server can store directly.
      const start = new Date(startLocal);
      if (isNaN(start.getTime())) throw new Error('Invalid start time');
      if (start.getTime() < Date.now()) throw new Error('Pick a time in the future');
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        start_at: start.toISOString(),
      });
    } catch (e) {
      setErr(e.message || 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 360,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
            fontSize: 14,
          }}>SCHEDULE EVENT</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--cn-text-mute)', display: 'flex',
          }} title="Close">
            <Icon name="x" size={16} sw={2} />
          </button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 120))}
            autoFocus
            placeholder="Fight night watch party with the boys"
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--cn-bg)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 14, outline: 'none',
              fontFamily: 'var(--cn-font-body)',
            }}
          />
          <label style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Starts</label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={e => setStartLocal(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--cn-bg)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 14, outline: 'none',
              fontFamily: 'var(--cn-font-body)',
            }}
          />
          <label style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Notes (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Doors at 8, fight starts 9:30…"
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--cn-bg)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--cn-font-body)', resize: 'vertical',
            }}
          />
          {err && (
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-danger)' }}>{err}</div>
          )}
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', lineHeight: 1.5 }}>
            Everyone in the group gets a notification 15 minutes before start.
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--cn-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', borderRadius: 999,
            background: 'transparent', color: 'var(--cn-text-dim)',
            border: '0.5px solid var(--cn-border-s)', cursor: 'pointer',
            fontWeight: 600, fontSize: 12, fontFamily: 'var(--cn-font-body)',
          }}>Cancel</button>
          <button onClick={submit} disabled={!title.trim() || !startLocal || busy} style={{
            padding: '8px 14px', borderRadius: 999,
            background: title.trim() && startLocal && !busy ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
            color:      title.trim() && startLocal && !busy ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
            border: 'none',
            cursor: title.trim() && startLocal && !busy ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
          }}>{busy ? 'Saving…' : 'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, mine, showAuthor, onReply }) {
  const [showActions, setShowActions] = React.useState(false);
  return (
    <div style={{
      display: 'flex', flexDirection: mine ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 8,
    }}>
      {!mine && <Avatar user={m.user} size={26} />}
      <div style={{ maxWidth: '75%' }}>
        {showAuthor && (
          <div style={{ fontSize: 10, fontFamily: 'var(--cn-font-mono)', color: 'var(--cn-text-mute)', marginBottom: 2, marginLeft: 2 }}>
            @{m.user.username}
          </div>
        )}
        <div
          onClick={() => setShowActions(s => !s)}
          style={{
            padding: '8px 12px',
            background: mine ? 'var(--cn-accent)' : 'var(--cn-bg-elev)',
            color: mine ? 'var(--cn-on-accent)' : 'var(--cn-text)',
            borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            fontSize: 13.5, lineHeight: 1.45,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: mine ? 'none' : '0.5px solid var(--cn-border)',
            cursor: 'pointer',
          }}
        >
          {m.reply_to && (
            <div style={{
              borderLeft: `2px solid ${mine ? 'var(--cn-on-accent)' : 'var(--cn-accent)'}`,
              paddingLeft: 6, marginBottom: 4,
              opacity: 0.85, fontSize: 11.5, lineHeight: 1.3,
            }}>
              <div style={{ fontWeight: 700, fontSize: 10, opacity: 0.9 }}>
                {m.reply_to.user?.displayName || ('@' + (m.reply_to.user?.username || ''))}
              </div>
              <div style={{
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>{m.reply_to.content}</div>
            </div>
          )}
          {typeof window !== 'undefined' && window.renderMentions
            ? window.renderMentions(m.content, mine ? 'var(--cn-on-accent)' : 'var(--cn-accent)')
            : m.content}
        </div>
        <div style={{ fontSize: 9, fontFamily: 'var(--cn-font-mono)', color: 'var(--cn-text-mute)', marginTop: 2, textAlign: mine ? 'right' : 'left', display: 'flex', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
          <span>{relTime(m.created_at)}</span>
          {showActions && onReply && (
            <button onClick={(e) => { e.stopPropagation(); setShowActions(false); onReply(); }} style={{
              background: 'transparent', border: 'none', padding: 0,
              color: 'var(--cn-accent)', fontSize: 10, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
            }}>Reply</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compose new conversation ─────────────────────────────────────────
function NewConversationScreen({ onNav, me, onCreated, onCancel }) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [picked, setPicked] = React.useState([]);    // [{id, displayName, username, ...}]
  const [groupName, setGroupName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const isGroup = picked.length > 1;

  React.useEffect(() => {
    const t = q.trim();
    if (!t) { setResults([]); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const list = await API.searchUsers(t);
        if (!cancelled) setResults(list || []);
      } catch (e) { if (!cancelled) setErr(e.message); }
    }, 200);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q]);

  const togglePick = (u) => {
    setPicked(prev => prev.find(p => p.id === u.id)
      ? prev.filter(p => p.id !== u.id)
      : [...prev, u]);
  };

  const create = async () => {
    if (!picked.length || busy) return;
    setBusy(true); setErr(null);
    try {
      const conv = await API.createConversation({
        user_ids: picked.map(p => p.id),
        is_group: isGroup,
        name: isGroup ? (groupName.trim() || null) : null,
      });
      onCreated?.(conv);
    } catch (e) {
      setErr(e.message || 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <ScreenTopBar
        title={isGroup ? 'NEW GROUP' : 'NEW MESSAGE'}
        onBack={onCancel}
        right={
          <button onClick={create} disabled={!picked.length || busy} style={{
            padding: '6px 12px', borderRadius: 999,
            background: picked.length && !busy ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
            color:      picked.length && !busy ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
            border: 'none', fontWeight: 700, fontSize: 12,
            cursor: picked.length && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--cn-font-body)',
          }}>{busy ? 'Starting…' : 'Start'}</button>
        }
      />

      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        {isGroup && (
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 13, marginBottom: 10,
              outline: 'none', fontFamily: 'var(--cn-font-body)',
            }}
          />
        )}
        {picked.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {picked.map(u => (
              <span key={u.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                background: 'color-mix(in srgb, var(--cn-accent) 16%, var(--cn-bg-elev))',
                border: '0.5px solid var(--cn-accent)',
                fontSize: 12, fontWeight: 600,
              }}>
                {displayHandle(u) || u.displayName || u.username}
                <button onClick={() => togglePick(u)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--cn-text)', padding: 0, display: 'flex',
                }}><Icon name="x" size={10} sw={2} /></button>
              </span>
            ))}
          </div>
        )}
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by username or name…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border-s)',
            color: 'var(--cn-text)', fontSize: 13,
            outline: 'none', fontFamily: 'var(--cn-font-body)',
          }}
        />
        {err && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {q.trim() === '' ? (
          <Empty>Type a username or name to find people.</Empty>
        ) : results.length === 0 ? (
          <Empty>No matches.</Empty>
        ) : results.map(u => {
          const sel = picked.find(p => p.id === u.id);
          return (
            <div key={u.id} onClick={() => togglePick(u)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)',
              cursor: 'pointer',
              background: sel ? 'color-mix(in srgb, var(--cn-accent) 6%, transparent)' : 'transparent',
            }}>
              <Avatar user={u} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.displayName}</div>
                {displayHandle(u) && (
                  <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>{displayHandle(u)}</div>
                )}
              </div>
              {sel ? (
                <span style={{ color: 'var(--cn-accent)', fontWeight: 800 }}>✓</span>
              ) : (
                <span style={{ color: 'var(--cn-text-mute)', fontSize: 16 }}>+</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScreenTopBar({ title, onBack, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg-elev2)',
    }}>
      <button style={iconBtnStyle()} onClick={onBack}>
        <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
      </button>
      <span style={{
        fontFamily: 'var(--cn-font-display)',
        fontWeight: 'var(--cn-display-weight)',
        textTransform: 'var(--cn-display-case)',
        letterSpacing: 'var(--cn-display-spacing)',
        fontSize: 14,
      }}>{title}</span>
      <span style={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
        {right || <span style={{ width: 32 }} />}
      </span>
    </div>
  );
}

function Empty({ children, danger }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center',
      color: danger ? 'var(--cn-danger)' : 'var(--cn-text-mute)',
      fontFamily: 'var(--cn-font-mono)', fontSize: 12,
    }}>{children}</div>
  );
}
function ghostMiniBtn(color) {
  return {
    padding: '4px 8px', borderRadius: 6,
    background: 'transparent', border: `1px solid ${color}`,
    color, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--cn-font-body)',
  };
}

Object.assign(window, {
  MessagesRoot, MessagesListScreen, ConversationScreen, NewConversationScreen,
});
