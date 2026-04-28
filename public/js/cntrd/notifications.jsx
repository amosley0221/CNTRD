// notifications.jsx — three-tab activity hub:
//   Scores    → game events (live_game, score, period_end, final)
//   Activity  → social events from people you connect with (follow,
//               follow_accept, message)
//   Requests  → incoming follow requests (and message requests once
//               we add a queueing concept)

const SCORE_TYPES    = new Set(['live_game', 'score', 'period_end', 'final']);
const ACTIVITY_TYPES = new Set(['follow', 'follow_accept', 'message']);

function categorizeNotif(n) {
  if (SCORE_TYPES.has(n.type))    return 'scores';
  if (ACTIVITY_TYPES.has(n.type)) return 'activity';
  if (n.type === 'follow_request') return 'requests';
  return 'activity';
}

function NotificationsScreen({ tweaks, onNav, me, setMessageContext, onUnreadNotifs }) {
  const onUnread = onUnreadNotifs;
  const [tab, setTab] = React.useState('scores');
  const [notifs, setNotifs] = React.useState([]);
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const [list, reqs] = await Promise.all([
        API.notifications(),
        API.followRequests(),
      ]);
      setNotifs(list || []);
      setRequests(reqs || []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  // Counts per tab — show on the tab pill if there's anything unread.
  const counts = React.useMemo(() => {
    const out = { scores: 0, activity: 0, requests: 0 };
    for (const n of notifs) {
      if (n.read) continue;
      const cat = categorizeNotif(n);
      if (cat in out) out[cat] += 1;
    }
    out.requests += requests.length;
    return out;
  }, [notifs, requests]);

  const filtered = notifs.filter(n => categorizeNotif(n) === tab);

  const markAllRead = async () => {
    await API.markAllNotifsRead();
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    onUnread?.(0);
  };
  const clearRead = async () => {
    if (typeof confirm === 'function' && !confirm('Dismiss every notification you\'ve already read?')) return;
    try {
      await API.dismissReadNotifs();
      setNotifs(prev => prev.filter(n => !n.read));
    } catch (e) { alert(e.message || 'Failed'); }
  };
  const dismissOne = async (n) => {
    try {
      await API.dismissNotif(n.id);
      setNotifs(prev => prev.filter(x => x.id !== n.id));
      if (!n.read) onUnread?.(c => Math.max(0, (c || 0) - 1));
    } catch (e) { alert(e.message || 'Failed'); }
  };

  const onNotifClick = async (n) => {
    if (!n.read) {
      try { await API.markNotifRead(n.id); } catch {}
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.type === 'message' && n.data?.conversation_id) {
      setMessageContext?.({ mode: 'thread', selectedId: n.data.conversation_id });
      onNav?.('messages');
      return;
    }
    if (n.type === 'follow_request') { setTab('requests'); return; }
    if (SCORE_TYPES.has(n.type) && n.data?.league && n.data?.game_id) {
      window.dispatchEvent(new CustomEvent('cntrd:open-game-from-notif',
        { detail: { id: n.data.game_id, league: n.data.league } }));
      return;
    }
  };

  const accept = async (req) => {
    try { await API.acceptFollowRequest(req.username); }
    catch (e) { return alert(e.message); }
    setRequests(prev => prev.filter(r => r.id !== req.id));
  };
  const reject = async (req) => {
    try { await API.rejectFollowRequest(req.username); }
    catch (e) { return alert(e.message); }
    setRequests(prev => prev.filter(r => r.id !== req.id));
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14,
        }}>NOTIFICATIONS</span>
        {tab !== 'requests' ? (
          <button onClick={notifs.some(n => !n.read) ? markAllRead : clearRead} style={{
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', color: 'var(--cn-accent)',
            border: '0.5px solid var(--cn-accent)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--cn-font-body)',
          }}>{notifs.some(n => !n.read) ? 'Mark all read' : 'Clear read'}</button>
        ) : <span style={{ width: 32 }} />}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--cn-border)' }}>
        {[
          { id: 'scores',   label: 'Scores',   count: counts.scores },
          { id: 'activity', label: 'Activity', count: counts.activity },
          { id: 'requests', label: 'Requests', count: counts.requests },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 0',
            background: 'transparent', border: 'none',
            color: tab === t.id ? 'var(--cn-text)' : 'var(--cn-text-mute)',
            fontFamily: 'var(--cn-font-body)', fontSize: 13, fontWeight: 600,
            borderBottom: tab === t.id ? '2px solid var(--cn-accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                padding: '0 6px', minWidth: 18, height: 16, borderRadius: 999,
                background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
                fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.count > 99 ? '99+' : t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <NotifEmpty>Loading…</NotifEmpty>
          : err ? <NotifEmpty danger>{err}</NotifEmpty>
          : tab === 'requests' ? (
            requests.length === 0
              ? <NotifEmpty>No pending requests.</NotifEmpty>
              : requests.map(r => <RequestRow key={r.id} req={r} onAccept={() => accept(r)} onReject={() => reject(r)} />)
          ) : filtered.length === 0 ? (
            <NotifEmpty>{
              tab === 'scores'
                ? 'No game updates yet. Notifications fire for leagues you follow + teams you favorite.'
                : 'Nothing here. Follows, replies, and DMs will show up.'
            }</NotifEmpty>
          ) : (
            filtered.map(n => <NotifRow key={n.id} n={n} onClick={() => onNotifClick(n)} onDismiss={() => dismissOne(n)} />)
          )
        }
      </div>
    </div>
  );
}

function NotifRow({ n, onClick, onDismiss }) {
  const text = renderNotifText(n);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
      background: n.read ? 'transparent' : 'color-mix(in srgb, var(--cn-accent) 6%, transparent)',
    }}>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <NotifIcon n={n} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--cn-text)', textWrap: 'pretty' }}>{text.headline}</div>
          {text.body && <div style={{ fontSize: 12, color: 'var(--cn-text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text.body}</div>}
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', marginTop: 4 }}>{relTime(n.created_at)}</div>
        </div>
        {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cn-accent)', flexShrink: 0 }} />}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} title="Dismiss" style={{
        width: 26, height: 26, borderRadius: '50%',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--cn-text-mute)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="x" size={14} sw={2} />
      </button>
    </div>
  );
}

function NotifIcon({ n }) {
  if (n.actor) return <Avatar user={n.actor} size={36} />;
  const code = n.data?.league || '🏆';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'color-mix(in srgb, var(--cn-accent) 18%, var(--cn-bg-elev))',
      border: '0.5px solid var(--cn-accent)',
      color: 'var(--cn-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
      fontFamily: 'var(--cn-font-mono)',
    }}>{code}</div>
  );
}

function renderNotifText(n) {
  const actor = n.actor?.displayName || (n.actor ? '@' + n.actor.username : 'Someone');
  const d = n.data || {};
  const matchup = (() => {
    const home = d.home_name || d.home || '';
    const away = d.away_name || d.away || '';
    return away && home ? `${away} @ ${home}` : (away || home || 'Game');
  })();
  const score = (Number.isFinite(Number(d.away_score)) && Number.isFinite(Number(d.home_score)))
    ? `${d.away_score}–${d.home_score}` : '';

  switch (n.type) {
    case 'follow':
      return { headline: `${actor} started following you`, body: n.actor ? '@' + n.actor.username : '' };
    case 'follow_request':
      return { headline: `${actor} requested to follow you`, body: 'Tap Requests to respond' };
    case 'follow_accept':
      return { headline: `${actor} accepted your follow request`, body: '' };
    case 'message':
      return { headline: `${actor} sent a message`, body: d.preview || '' };
    case 'live_game':
      return { headline: `${matchup} just tipped off`, body: `${d.league || ''} · ${d.period || 'Live'}` };
    case 'score': {
      // play_text comes from ESPN's play-by-play and reads naturally:
      // "Hurts pass to Smith for 25 yds, TD". Fall back to "<team> scored"
      // if a play row didn't carry text (rare).
      if (d.play_text) {
        return {
          headline: d.play_text,
          body: `${matchup} · ${score}${d.play_period ? ' · Q' + d.play_period : ''}`,
        };
      }
      const scoringTeam = d.scoring_side === 'home' ? (d.home_name || d.home) : (d.away_name || d.away);
      return { headline: `${scoringTeam || 'A team'} scored`, body: `${matchup} · ${score}${d.period ? ' · ' + d.period : ''}` };
    }
    case 'period_end':
      return { headline: `${d.period || 'Period ended'}`, body: `${matchup}${score ? ' · ' + score : ''}` };
    case 'final':
      return { headline: 'Final', body: `${matchup}${score ? ' · ' + score : ''}` };
    default:
      return { headline: 'Notification', body: '' };
  }
}

function RequestRow({ req, onAccept, onReject }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
    }}>
      <Avatar user={req} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{req.displayName}</div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>@{req.username} · {relTime(req.requested_at)}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onAccept} style={{
          padding: '6px 12px', borderRadius: 6,
          background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
          border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--cn-font-body)',
        }}>Accept</button>
        <button onClick={onReject} style={{
          padding: '6px 12px', borderRadius: 6,
          background: 'transparent', color: 'var(--cn-text-dim)',
          border: '0.5px solid var(--cn-border-s)', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--cn-font-body)',
        }}>Decline</button>
      </div>
    </div>
  );
}

function NotifEmpty({ children, danger }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center',
      color: danger ? 'var(--cn-danger)' : 'var(--cn-text-mute)',
      fontFamily: 'var(--cn-font-mono)', fontSize: 12, lineHeight: 1.6,
    }}>{children}</div>
  );
}

Object.assign(window, { NotificationsScreen });
