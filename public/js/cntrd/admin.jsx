// admin.jsx — Admin-only screen: user list, ban/unban, post deletion.
// Visible only when window.ME.is_admin is true; gated server-side too.

function AdminScreen({ tweaks, onNav, me }) {
  const [users, setUsers] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [expanded, setExpanded] = React.useState(null);    // user id whose posts are open
  const [postsByUser, setPostsByUser] = React.useState({});

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [u, s] = await Promise.all([API.adminUsers(q), API.adminStats()]);
      setUsers(u || []);
      setStats(s || null);
    } catch (e) {
      setErr(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => { load(); }, [load]);

  const ban = async (id) => {
    try { await API.adminBan(id); setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: true } : u)); }
    catch (e) { alert(e.message || 'Ban failed'); }
  };
  const unban = async (id) => {
    try { await API.adminUnban(id); setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: false } : u)); }
    catch (e) { alert(e.message || 'Unban failed'); }
  };
  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!postsByUser[id]) {
      try {
        const list = await API.adminUserPosts(id);
        setPostsByUser(prev => ({ ...prev, [id]: list }));
      } catch (e) {
        setPostsByUser(prev => ({ ...prev, [id]: [] }));
      }
    }
  };
  const deletePost = async (userId, postId) => {
    if (!confirm('Delete this post permanently?')) return;
    try {
      await API.adminDeletePost(postId);
      setPostsByUser(prev => ({ ...prev, [userId]: (prev[userId] || []).filter(p => p.id !== postId) }));
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, post_count: Math.max(0, (u.post_count ?? 1) - 1) } : u));
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <button onClick={() => onNav?.('settings')} style={iconBtnStyle()}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>ADMIN</span>
        <span style={{ width: 32 }} />
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
        }}>
          <AdminStat label="Users"   value={stats.users} />
          <AdminStat label="Banned"  value={stats.banned} />
          <AdminStat label="Posts"   value={stats.posts} />
          <AdminStat label="7-day"   value={stats.signups_last_7d} sub="signups" />
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by username, email, or display name…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
            color: 'var(--cn-text)', fontSize: 13, outline: 'none',
            fontFamily: 'var(--cn-font-body)',
          }}
        />
      </div>

      {err && (
        <div style={{ padding: '10px 16px', color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
          {err}
        </div>
      )}

      {/* Site pages — admin can edit Terms/Privacy/About */}
      <div style={{
        padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginRight: 4 }}>Site pages:</span>
        {['terms', 'privacy', 'about'].map(slug => (
          <button key={slug} onClick={() => onNav?.(slug)} style={{
            padding: '5px 10px', borderRadius: 6,
            background: 'transparent',
            border: '0.5px solid var(--cn-border-s)',
            color: 'var(--cn-text)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--cn-font-body)',
            textTransform: 'capitalize',
          }}>{slug}</button>
        ))}
      </div>

      {/* User list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11 }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11 }}>No users found.</div>
        ) : (
          users.map(u => (
            <AdminUserRow
              key={u.id}
              user={u}
              isMe={u.id === me?.id}
              expanded={expanded === u.id}
              posts={postsByUser[u.id]}
              onToggle={() => toggleExpand(u.id)}
              onBan={() => ban(u.id)}
              onUnban={() => unban(u.id)}
              onDeletePost={(postId) => deletePost(u.id, postId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AdminStat({ label, value, sub }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 10,
      background: 'var(--cn-bg-elev)',
      border: '0.5px solid var(--cn-border)',
    }}>
      <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: 'var(--cn-display-spacing)' }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)', letterSpacing: 0.7, textTransform: 'uppercase' }}>
        {label}{sub ? ' ' + sub : ''}
      </div>
    </div>
  );
}

function AdminUserRow({ user, isMe, expanded, posts, onToggle, onBan, onUnban, onDeletePost }) {
  const meUser = {
    username: user.username,
    displayName: user.display_name || user.username,
    avatarHue: user.avatar_hue ?? 200,
    avatar: user.avatar,
  };
  const joined = user.created_at ? new Date(user.created_at.replace(' ', 'T') + 'Z').toLocaleDateString() : '';
  return (
    <div style={{ borderBottom: '0.5px solid var(--cn-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <Avatar user={meUser} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{meUser.displayName}</span>
            {user.is_admin && <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'var(--cn-accent)', color: 'var(--cn-on-accent)', letterSpacing: 0.5 }}>ADMIN</span>}
            {user.banned && <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'var(--cn-danger)', color: '#fff', letterSpacing: 0.5 }}>BANNED</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{user.username} · {user.email} · {user.post_count ?? 0} posts · {joined}
          </div>
          {(user.team_tags && user.team_tags.length > 0) && (
            <div style={{ marginTop: 4 }}>
              <TeamTagsRow codes={user.team_tags} size="xs" />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isMe && !user.is_admin && (
            user.banned
              ? <button onClick={onUnban} style={adminBtn('var(--cn-success)')}>Unban</button>
              : <button onClick={onBan}   style={adminBtn('var(--cn-danger)')}>Ban</button>
          )}
          <button onClick={onToggle} style={{ ...iconBtnStyle(), transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <Icon name="chevron-r" size={16} stroke="var(--cn-text-mute)" />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          {!posts ? (
            <div style={{ fontSize: 11, fontFamily: 'var(--cn-font-mono)', color: 'var(--cn-text-mute)', padding: '8px 0' }}>Loading posts…</div>
          ) : posts.length === 0 ? (
            <div style={{ fontSize: 11, fontFamily: 'var(--cn-font-mono)', color: 'var(--cn-text-mute)', padding: '8px 0' }}>No posts.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {posts.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--cn-bg-elev)',
                  border: '0.5px solid var(--cn-border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cn-text)', wordBreak: 'break-word' }}>
                      {p.content}
                    </div>
                    <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', marginTop: 4 }}>
                      {p.type} · {p.created_at} · {p.like_count} likes
                    </div>
                  </div>
                  <button onClick={() => onDeletePost(p.id)} style={adminBtn('var(--cn-danger)')}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function adminBtn(color) {
  return {
    padding: '5px 10px', borderRadius: 6,
    background: 'transparent',
    border: `1px solid ${color}`,
    color, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--cn-font-body)',
  };
}

Object.assign(window, { AdminScreen });
