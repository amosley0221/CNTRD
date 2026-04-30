// follow-list.jsx — paged list of either followers or who you follow.
// One screen, two modes. Each row has an action menu calibrated to
// what's possible from that side:
//   · followers → Remove follower / Follow back / Unfollow / Mute / Block
//   · following → Unfollow / Mute / Block
// Tapping anywhere else on the row routes to the user's profile.

function FollowListScreen({ tweaks, onNav, me, followListMode, followListUsername }) {
  const mode = followListMode === 'following' ? 'following' : 'followers';
  const username = followListUsername || me?.username;
  const [items, setItems] = React.useState(null);   // null = loading
  const [err, setErr]     = React.useState(null);
  const [busyIds, setBusyIds] = React.useState(new Set());

  const isMyList = !!me?.username && me.username === username;

  React.useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const data = mode === 'following'
          ? await window.API.followingList(username)
          : await window.API.followers(username);
        if (!cancelled) setItems(data || []);
      } catch (e) {
        if (!cancelled) { setItems([]); setErr(e.message || 'Failed to load'); }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, username]);

  const setBusy = (id, on) => setBusyIds(prev => {
    const n = new Set(prev);
    if (on) n.add(id); else n.delete(id);
    return n;
  });

  const updateRow = (id, patch) => setItems(prev =>
    (prev || []).map(u => u.id === id ? { ...u, ...patch } : u));

  // Actions ---------------------------------------------------------------
  const followToggle = async (u) => {
    setBusy(u.id, true);
    try {
      const res = await window.API.followUser(u.username);
      const nowFollowing = !!(res?.is_following ?? res?.following);
      updateRow(u.id, { i_follow_them: nowFollowing });
      window.dispatchEvent(new CustomEvent('cntrd:me-follow-delta', {
        detail: { delta: nowFollowing ? +1 : -1 },
      }));
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setBusy(u.id, false); }
  };

  const muteToggle = async (u) => {
    setBusy(u.id, true);
    try {
      const res = await window.API.muteUser(u.username);
      updateRow(u.id, { i_mute_them: !!res?.muted });
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setBusy(u.id, false); }
  };

  const blockUser = async (u) => {
    const ok = await confirmAction({
      title: `Block @${u.username}?`,
      message: "You won't see their posts and they won't see yours.",
      confirmLabel: 'Block', danger: true,
    });
    if (!ok) return;
    setBusy(u.id, true);
    try {
      await window.API.blockUser(u.username);
      // Remove from list since the relationship is now hidden either way.
      setItems(prev => (prev || []).filter(x => x.id !== u.id));
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setBusy(u.id, false); }
  };

  const removeFollower = async (u) => {
    const ok = await confirmAction({
      title: `Remove @${u.username} as a follower?`,
      message: "They'll no longer follow you. They can re-follow later.",
      confirmLabel: 'Remove', danger: true,
    });
    if (!ok) return;
    setBusy(u.id, true);
    try {
      await window.API.removeFollower(u.username);
      setItems(prev => (prev || []).filter(x => x.id !== u.id));
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setBusy(u.id, false); }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <span style={{
            fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
            fontSize: 14,
          }}>{mode === 'following' ? 'FOLLOWING' : 'FOLLOWERS'}</span>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>@{username || ''}</span>
        </div>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {items === null ? (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-mute)' }}>
            Loading…
          </div>
        ) : err ? (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-danger)' }}>
            {err}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-mute)', lineHeight: 1.6 }}>
            {mode === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}
          </div>
        ) : items.map(u => (
          <FollowListRow
            key={u.id}
            user={u}
            isMe={u.id === me?.id}
            isMyList={isMyList}
            mode={mode}
            busy={busyIds.has(u.id)}
            onOpen={() => window.dispatchEvent(new CustomEvent('cntrd:open-user', { detail: { username: u.username } }))}
            onFollowToggle={() => followToggle(u)}
            onMuteToggle={() => muteToggle(u)}
            onBlock={() => blockUser(u)}
            onRemoveFollower={() => removeFollower(u)}
          />
        ))}
      </div>
    </div>
  );
}

function FollowListRow({ user, isMe, isMyList, mode, busy, onOpen, onFollowToggle, onMuteToggle, onBlock, onRemoveFollower }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);
  const meUser = {
    username: user.username,
    displayName: user.display_name || user.username,
    avatarHue: user.avatar_hue ?? 200,
    avatar: user.avatar,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
      <button onClick={onOpen} title={`@${user.username}`} style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
        color: 'inherit', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <Avatar user={meUser} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meUser.displayName}
            </span>
            <RoleBadges user={user} size={12} />
          </div>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
            @{user.username}
          </div>
          {user.team_tags && user.team_tags.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <TeamTagsRow codes={user.team_tags} size="xs" />
            </div>
          )}
        </div>
      </button>
      {!isMe && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
            disabled={busy}
            style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', cursor: 'pointer',
              fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 11,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Manage
            <Icon name="chevron-r" size={11} stroke="var(--cn-text-mute)" sw={2} />
          </button>
          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              minWidth: 200,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border)',
              borderRadius: 10, overflow: 'hidden',
              boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
              zIndex: 20,
            }}>
              <FollowListMenuItem
                label={user.i_follow_them ? 'Unfollow' : 'Follow'}
                onClick={() => { setMenuOpen(false); onFollowToggle(); }}
              />
              <FollowListMenuItem
                label={user.i_mute_them ? 'Unmute' : 'Mute'}
                sub={user.i_mute_them ? 'Their posts will appear again' : 'Hide their posts from your feed'}
                onClick={() => { setMenuOpen(false); onMuteToggle(); }}
              />
              {isMyList && mode === 'followers' && (
                <FollowListMenuItem
                  label="Remove follower"
                  sub="They won't follow you anymore"
                  danger
                  onClick={() => { setMenuOpen(false); onRemoveFollower(); }}
                />
              )}
              <FollowListMenuItem
                label={`Block @${user.username}`}
                sub="Hides them from your feed and stops contact"
                danger
                onClick={() => { setMenuOpen(false); onBlock(); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FollowListMenuItem({ label, sub, danger, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%',
      padding: '10px 14px',
      background: 'transparent', border: 'none',
      borderBottom: '0.5px solid var(--cn-border)',
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'var(--cn-font-body)',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: danger ? 'var(--cn-danger)' : 'var(--cn-text)',
      }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', marginTop: 2 }}>{sub}</div>
      )}
    </button>
  );
}

Object.assign(window, { FollowListScreen });
