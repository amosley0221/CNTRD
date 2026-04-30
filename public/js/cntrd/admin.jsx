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
  const [tab, setTab] = React.useState('users');             // 'users' | 'reports'
  const [reportsCounts, setReportsCounts] = React.useState({ pending: 0, escalated: 0 });

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

  // Refresh report counts whenever the screen loads or the tab flips
  // back to Users — keeps the badge fresh without polling forever.
  React.useEffect(() => {
    let cancelled = false;
    API.reportsCounts().then(c => { if (!cancelled) setReportsCounts(c || { pending: 0, escalated: 0 }); });
    return () => { cancelled = true; };
  }, [tab]);

  const ban = async (id) => {
    try { await API.adminBan(id); setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: true } : u)); }
    catch (e) { alert(e.message || 'Ban failed'); }
  };
  const unban = async (id) => {
    try { await API.adminUnban(id); setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: false } : u)); }
    catch (e) { alert(e.message || 'Unban failed'); }
  };
  const toggleAdmin = async (id) => {
    try {
      const r = await API.adminToggleAdmin(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_admin: !!r.is_admin } : u));
    } catch (e) { alert(e.message || 'Failed'); }
  };
  const toggleVerified = async (id) => {
    try {
      const r = await API.adminToggleVerified(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_verified: !!r.is_verified } : u));
    } catch (e) { alert(e.message || 'Failed'); }
  };
  const toggleOfficial = async (id) => {
    try {
      const r = await API.adminToggleOfficial(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_official: !!r.is_official } : u));
    } catch (e) { alert(e.message || 'Failed'); }
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
    const ok = await confirmAction({
      title: 'Delete this post?',
      message: "This will remove it for everyone. Can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
        <button onClick={() => onNav?.('back')} style={iconBtnStyle()}>
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

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '8px 16px 0', gap: 8, borderBottom: '0.5px solid var(--cn-border)' }}>
        {[
          { id: 'users',   label: 'Users' },
          { id: 'reports', label: 'Reports', badge: reportsCounts.pending + reportsCounts.escalated },
          ...(me?.is_owner ? [{ id: 'watchwords', label: 'Watchwords' }] : []),
        ].map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 12px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: active ? '2px solid var(--cn-accent)' : '2px solid transparent',
              color: active ? 'var(--cn-text)' : 'var(--cn-text-mute)',
              fontWeight: 700, fontSize: 13, fontFamily: 'var(--cn-font-body)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.badge ? (
                <span style={{
                  padding: '0 6px', minWidth: 18, height: 18, borderRadius: 999,
                  background: 'var(--cn-danger)', color: '#fff',
                  fontFamily: 'var(--cn-font-mono)', fontSize: 10, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{t.badge > 99 ? '99+' : t.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'reports' ? (
        <ReportsTab me={me} onCounts={setReportsCounts} />
      ) : tab === 'watchwords' && me?.is_owner ? (
        <WatchwordsTab />
      ) : (<>
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
              meIsOwner={!!me?.is_owner}
              expanded={expanded === u.id}
              posts={postsByUser[u.id]}
              onToggle={() => toggleExpand(u.id)}
              onBan={() => ban(u.id)}
              onUnban={() => unban(u.id)}
              onToggleAdmin={() => toggleAdmin(u.id)}
              onToggleVerified={() => toggleVerified(u.id)}
              onToggleOfficial={() => toggleOfficial(u.id)}
              onDeletePost={(postId) => deletePost(u.id, postId)}
            />
          ))
        )}
      </div>
      </>)}
    </div>
  );
}

function ReportsTab({ me, onCounts }) {
  const [filter, setFilter] = React.useState('pending');  // 'pending' | 'escalated' | 'resolved' | 'all'
  const [reports, setReports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(null);            // report id while resolving

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const list = await API.reportsList(filter);
      setReports(list || []);
      const counts = await API.reportsCounts();
      onCounts?.(counts || { pending: 0, escalated: 0 });
    } catch (e) {
      setErr(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [filter, onCounts]);
  React.useEffect(() => { load(); }, [load]);

  const resolve = async (r, action, days) => {
    setBusy(r.id);
    try {
      const note = action === 'escalate'
        ? (window.prompt('Add a note for the owner (optional):', '') || '')
        : '';
      await API.reportResolve(r.id, { action, days, note });
      await load();
    } catch (e) {
      alert(e.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: '10px 16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { id: 'pending',    label: 'Pending' },
          { id: 'escalated',  label: 'Escalated' },
          { id: 'resolved',   label: 'Resolved' },
          { id: 'all',        label: 'All' },
        ].map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '6px 12px', borderRadius: 999,
              background: active ? 'var(--cn-accent)' : 'transparent',
              color: active ? 'var(--cn-on-accent)' : 'var(--cn-text-dim)',
              border: `0.5px solid ${active ? 'transparent' : 'var(--cn-border-s)'}`,
              fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 11,
              cursor: 'pointer',
            }}>{f.label}</button>
          );
        })}
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Loading…</div>}
      {err && <div style={{ padding: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>{err}</div>}
      {!loading && !err && reports.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
          Nothing in this queue.
        </div>
      )}

      {reports.map(r => (
        <ReportCard
          key={r.id}
          r={r}
          me={me}
          busy={busy === r.id}
          onResolve={resolve}
        />
      ))}
    </div>
  );
}

function ReportCard({ r, me, busy, onResolve }) {
  const isEscalated = r.status === 'escalated';
  const isResolved = r.status === 'resolved';
  const lockedToOwner = isEscalated && !me?.is_owner;
  return (
    <div style={{
      padding: 14, marginBottom: 10, borderRadius: 12,
      background: 'var(--cn-bg-elev)',
      border: `0.5px solid ${isEscalated ? 'var(--cn-danger)' : 'var(--cn-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 6,
          background: isEscalated ? 'var(--cn-danger)' : isResolved ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
          color: isEscalated ? '#fff' : isResolved ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
          fontFamily: 'var(--cn-font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: 1,
          textTransform: 'uppercase',
        }}>{r.status}</span>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          {r.target_type} · {relTime(r.created_at)}
        </span>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        {r.auto_flag ? (
          <>
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-warn)', fontWeight: 800, letterSpacing: 1 }}>
              AUTO-FLAG{r.matched_term ? ` · "${r.matched_term}"` : ''}
            </span>
            <span style={{ color: 'var(--cn-text-mute)' }}> on </span>
            {r.target_user
              ? <strong>@{r.target_user.username}</strong>
              : <span>{r.target_type}</span>}
          </>
        ) : (
          <>
            <strong>@{r.reporter?.username || 'someone'}</strong>
            <span style={{ color: 'var(--cn-text-mute)' }}> reported </span>
            {r.target_user
              ? <strong>@{r.target_user.username}</strong>
              : <span>{r.target_type}</span>}
          </>
        )}
        {r.target_user?.banned && (
          <span style={{ marginLeft: 6, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 10, fontWeight: 800 }}>
            BANNED{r.target_user.banned_until ? ` · until ${r.target_user.banned_until}` : ''}
          </span>
        )}
      </div>
      {r.reason && (
        <div style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 8,
          background: 'var(--cn-bg)', fontSize: 12, color: 'var(--cn-text-dim)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{r.reason}</div>
      )}
      {r.content_snapshot && (
        <div style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 8,
          background: 'var(--cn-bg)',
          border: '0.5px solid var(--cn-border-s)',
          fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 160, overflow: 'auto',
        }}>
          <div style={{ fontSize: 9, color: 'var(--cn-text-mute)', letterSpacing: 1, marginBottom: 4 }}>SNAPSHOT</div>
          {r.content_snapshot}
        </div>
      )}
      {r.media_url && (
        <a href={r.media_url} target="_blank" rel="noopener" style={{
          display: 'block', marginTop: 8, borderRadius: 8, overflow: 'hidden',
          border: '0.5px solid var(--cn-border-s)', background: '#000',
          maxHeight: 200,
        }}>
          {/\.(mp4|mov|webm)$/i.test(r.media_url) ? (
            <video src={r.media_url} controls muted style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#000' }} />
          ) : (
            <img src={r.media_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#000' }} />
          )}
        </a>
      )}
      {isResolved && (
        <div style={{ marginTop: 8, fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          Resolved by @{r.resolver?.username || '?'} · {r.resolution}
          {r.ban_until ? ` · ban until ${r.ban_until}` : ''}
          {r.resolution_note ? ` · "${r.resolution_note}"` : ''}
        </div>
      )}

      {!isResolved && (
        lockedToOwner ? (
          <div style={{
            marginTop: 10, fontFamily: 'var(--cn-font-mono)', fontSize: 11,
            color: 'var(--cn-text-mute)', fontStyle: 'italic',
          }}>Awaiting owner review</div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => onResolve(r, 'dismiss')} disabled={busy} style={mini('var(--cn-text-dim)')}>
              Dismiss
            </button>
            <button onClick={() => onResolve(r, 'remove_content')} disabled={busy} style={mini('var(--cn-warn)')}>
              Remove content
            </button>
            <button onClick={() => onResolve(r, 'temp_ban', 1)} disabled={busy || !r.target_user} style={mini('var(--cn-danger)')}>
              Ban 1d
            </button>
            <button onClick={() => onResolve(r, 'temp_ban', 7)} disabled={busy || !r.target_user} style={mini('var(--cn-danger)')}>
              Ban 7d
            </button>
            <button onClick={() => onResolve(r, 'temp_ban', 30)} disabled={busy || !r.target_user} style={mini('var(--cn-danger)')}>
              Ban 30d
            </button>
            {!isEscalated && !me?.is_owner && (
              <button onClick={() => onResolve(r, 'escalate')} disabled={busy} style={mini('var(--cn-accent)')}>
                Escalate to owner
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function mini(color) {
  return {
    padding: '6px 10px', borderRadius: 999,
    background: 'transparent', color,
    border: `0.5px solid ${color}`,
    fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 11,
    cursor: 'pointer',
  };
}

function WatchwordsTab() {
  const [list, setList] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const rows = await API.watchwordsList();
      setList(rows || []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  const add = async () => {
    const w = draft.trim();
    if (!w || busy) return;
    setBusy(true); setErr(null);
    try {
      await API.watchwordsAdd(w);
      setDraft('');
      await refresh();
    } catch (e) {
      setErr(e.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setBusy(true); setErr(null);
    try {
      await API.watchwordsRemove(id);
      setList(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      setErr(e.message || 'Could not remove');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          Auto-flag watchwords
        </div>
        <div style={{ fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
          Posts and Plays whose body matches any of these terms (whole word, case-insensitive)
          will fire an automatic review notification to you. Admins won't be pinged on auto-flags.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, 60))}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a word…"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 999,
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border-s)',
            color: 'var(--cn-text)', fontSize: 13,
            outline: 'none', fontFamily: 'var(--cn-font-body)',
          }}
        />
        <button onClick={add} disabled={!draft.trim() || busy} style={{
          padding: '10px 16px', borderRadius: 999,
          background: draft.trim() && !busy ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
          color:      draft.trim() && !busy ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
          border: 'none', cursor: busy ? 'wait' : (draft.trim() ? 'pointer' : 'not-allowed'),
          fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
        }}>{busy ? '…' : 'Add'}</button>
      </div>

      {err && <div style={{ marginBottom: 10, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>{err}</div>}
      {loading && <div style={{ padding: 12, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Loading…</div>}
      {!loading && list.length === 0 && (
        <div style={{ padding: 12, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
          No watchwords yet.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(w => (
          <span key={w.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 10px 6px 14px', borderRadius: 999,
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border-s)',
            fontSize: 13, fontWeight: 600,
          }}>
            {w.word}
            <button onClick={() => remove(w.id)} disabled={busy} style={{
              background: 'transparent', border: 'none',
              color: 'var(--cn-text-mute)',
              cursor: 'pointer', padding: 0, display: 'flex',
            }} title="Remove">
              <Icon name="x" size={14} stroke="currentColor" />
            </button>
          </span>
        ))}
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

function AdminUserRow({
  user, isMe, meIsOwner, expanded, posts,
  onToggle, onBan, onUnban,
  onToggleAdmin, onToggleVerified, onToggleOfficial,
  onDeletePost,
}) {
  const meUser = {
    username: user.username,
    displayName: user.display_name || user.username,
    avatarHue: user.avatar_hue ?? 200,
    avatar: user.avatar,
  };
  const joined = user.created_at ? new Date(user.created_at.replace(' ', 'T') + 'Z').toLocaleDateString() : '';
  // Permission rules for the row's actions:
  //   · Nothing on yourself (isMe)
  //   · The owner is fully protected — no one can act on them
  //   · Admins can be acted on only by the owner
  const isOwner = !!user.is_owner;
  const canAct = !isMe && !isOwner && (!user.is_admin || meIsOwner);
  const canToggleAdmin = !isMe && !isOwner && meIsOwner;
  return (
    <div style={{ borderBottom: '0.5px solid var(--cn-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <Avatar user={meUser} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{meUser.displayName}</span>
            <RoleBadges user={user} size={12} />
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
          {/* Role / badge toggles. Verified + Official: any admin. Admin
              role: owner only. */}
          {!isMe && !isOwner && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button onClick={onToggleVerified} style={pillBtn(user.is_verified, 'var(--cn-accent)')}>
                {user.is_verified ? '✓ Verified' : 'Verify'}
              </button>
              <button onClick={onToggleOfficial} style={pillBtn(user.is_official, '#3B82F6')}>
                {user.is_official ? '✓ Official' : 'Mark official'}
              </button>
              {canToggleAdmin && (
                <button onClick={onToggleAdmin} style={pillBtn(user.is_admin, '#FFD15A', '#0A0A0B')}>
                  {user.is_admin ? '★ Admin' : 'Make admin'}
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canAct && (
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
function pillBtn(active, color, fg) {
  return {
    padding: '4px 10px', borderRadius: 999,
    background: active ? color : 'transparent',
    color: active ? (fg || '#fff') : color,
    border: `0.5px solid ${color}`,
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--cn-font-mono)', letterSpacing: 0.4,
  };
}

Object.assign(window, { AdminScreen });
