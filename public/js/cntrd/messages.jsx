// messages.jsx — DMs and group chats.
// Three screens stacked into one navigable flow:
//   MessagesScreen   → list of conversations
//   ConversationScreen → view + send messages in a thread
//   NewConversationScreen → search users, pick, name (group), create

// Convention: app passes a `messageContext` prop = { selectedId, mode }.
// `mode` is 'list' | 'thread' | 'new'.

function MessagesRoot({ tweaks, onNav, me, messageContext, setMessageContext, onUnread }) {
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
    onOpenThread={(id) => setMessageContext?.({ mode: 'thread', selectedId: id })}
    onCompose={() => setMessageContext?.({ mode: 'new' })}
    onUnread={onUnread}
  />;
}

// ─── List of conversations ────────────────────────────────────────────
function MessagesListScreen({ onNav, me, onOpenThread, onCompose, onUnread }) {
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
        onBack={() => onNav?.('home')}
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <Empty>Loading…</Empty>
          : err ? <Empty danger>{err}</Empty>
          : convs.length === 0 ? <EmptyState onCompose={onCompose} />
          : convs.map(c => <ConversationRow key={c.id} conv={c} me={me} onClick={() => onOpenThread(c.id)} />)}
      </div>
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
  const [draft, setDraft] = React.useState('');
  const [err, setErr] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const scrollRef = React.useRef(null);

  const load = React.useCallback(async () => {
    try {
      const [c, ms] = await Promise.all([
        API.conversation(conversationId),
        API.conversationMessages(conversationId),
      ]);
      setConv(c);
      setMessages(ms);
      onUnread?.(0);            // we just opened it; clear unread badge optimistically
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
    try {
      const m = await API.sendMessage(conversationId, text);
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
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, padding: 24 }}>
            Say hi — this conversation is empty.
          </div>
        ) : messages.map((m, i) => {
          const mine = m.user.id === me?.id;
          const prev = messages[i - 1];
          const showAuthor = !mine && (!prev || prev.user.id !== m.user.id);
          return <MessageBubble key={m.id} m={m} mine={mine} showAuthor={showAuthor && conv.is_group} />;
        })}
      </div>

      <div style={{
        padding: '10px 12px 14px',
        borderTop: '0.5px solid var(--cn-border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--cn-bg-elev2)',
      }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message…"
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
    </div>
  );
}

function MessageBubble({ m, mine, showAuthor }) {
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
        <div style={{
          padding: '8px 12px',
          background: mine ? 'var(--cn-accent)' : 'var(--cn-bg-elev)',
          color: mine ? 'var(--cn-on-accent)' : 'var(--cn-text)',
          borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          fontSize: 13.5, lineHeight: 1.45,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          border: mine ? 'none' : '0.5px solid var(--cn-border)',
        }}>{m.content}</div>
        <div style={{ fontSize: 9, fontFamily: 'var(--cn-font-mono)', color: 'var(--cn-text-mute)', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
          {relTime(m.created_at)}
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
                @{u.username}
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
                <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>@{u.username}</div>
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
