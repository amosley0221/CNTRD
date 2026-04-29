// mobile-screens.jsx — remaining mobile screens for CNTRD
// profile, composer, plays creator, plays viewer, signup, login, settings, gameday chat

// Tile for the profile "Plays" tab. Tap to view; small × in the corner
// to delete with confirm.
function ProfilePlayTile({ play, onOpen, onDelete }) {
  const team = resolveTeam(play.team) || { primary: '#444', accent: '#888', name: '' };
  const remove = async (e) => {
    e.stopPropagation();
    if (typeof confirm === 'function' && !confirm('Delete this Play permanently?')) return;
    try { await onDelete?.(play.id); } catch (e) { alert(e.message || 'Failed'); }
  };
  return (
    <div onClick={() => onOpen?.(play)} style={{
      position: 'relative',
      aspectRatio: 9/16, borderRadius: 6, overflow: 'hidden',
      background: `linear-gradient(135deg, ${team.primary}, ${team.accent})`,
      display: 'flex', alignItems: 'flex-end', padding: 6,
      cursor: onOpen ? 'pointer' : 'default',
    }}>
      <div style={{
        fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{play.label || ''}</div>
      <button onClick={remove} title="Delete play" style={{
        position: 'absolute', top: 4, right: 4,
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        border: 'none', cursor: 'pointer',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="x" size={12} stroke="#fff" sw={2.4} />
      </button>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────
function ProfileScreen({ tweaks, onNav, me, posts, plays, onOpenPlay, onDeletePlay, onPullRefreshFeed, unreadMessages = 0 }) {
  const u = me || ME;
  const teams = (u.teams && u.teams.length) ? u.teams : ['LAL'];
  const coverFrom = resolveTeam(teams[0]) || resolveTeam('LAL') || { primary: '#552583', accent: '#FDB927' };
  const coverTo   = resolveTeam(teams[teams.length - 1]) || coverFrom;
  const myPosts = (posts && posts.length)
    ? posts
    : POSTS.filter(p =>
        (typeof p.user === 'string' ? p.user : p.user?.username) === u.username
      ).concat(POSTS.slice(0, 3));
  const [tab, setTab] = React.useState('posts');
  const [bookmarks, setBookmarks] = React.useState(null);
  const [bookmarksErr, setBookmarksErr] = React.useState(null);
  const scrollerRef = React.useRef(null);

  const loadBookmarks = React.useCallback(async () => {
    try {
      const list = await window.API.myBookmarks();
      setBookmarks((list || []).map(window.normalizePost));
      setBookmarksErr(null);
    } catch (e) {
      setBookmarks([]); setBookmarksErr(e.message || 'Failed to load');
    }
  }, []);

  // Lazy-load the bookmarks list when the user opens the tab. They're private
  // to the viewer, so this only runs when looking at their own profile.
  React.useEffect(() => {
    if (tab !== 'bookmarks' || bookmarks !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await window.API.myBookmarks();
        if (!cancelled) setBookmarks((list || []).map(window.normalizePost));
      } catch (e) {
        if (!cancelled) { setBookmarks([]); setBookmarksErr(e.message || 'Failed to load'); }
      }
    })();
    return () => { cancelled = true; };
  }, [tab, bookmarks]);

  // Pull-to-refresh: refetch the feed (which feeds this screen via the
  // shared `posts` state) and, if we're on the Saved tab, reload bookmarks.
  const onPullRefresh = React.useCallback(async () => {
    const tasks = [onPullRefreshFeed?.()];
    if (tab === 'bookmarks') tasks.push(loadBookmarks());
    await Promise.all(tasks);
  }, [tab, onPullRefreshFeed, loadBookmarks]);
  const { distance: pullDistance, refreshing: pullRefreshing } =
    usePullToRefresh(scrollerRef, onPullRefresh);
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')}><Icon name="chevron-l" size={22} stroke="var(--cn-text)" /></button>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)' }}>@{u.username}</span>
        <button style={iconBtnStyle()} onClick={() => onNav?.('settings')}><Icon name="settings" size={20} stroke="var(--cn-text)" /></button>
      </div>
      <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: 96, overscrollBehaviorY: 'contain' }}>
        <PullIndicator distance={pullDistance} refreshing={pullRefreshing} />
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
            <Avatar user={u} size={88} ring />
            <button style={{
              padding: '8px 16px', borderRadius: 999,
              background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
              border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'var(--cn-font-body)',
              cursor: 'pointer',
            }}>Edit profile</button>
          </div>
          <div style={{
            fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
            fontSize: 24, lineHeight: 1.05,
          }}>{u.displayName}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)' }}>@{u.username}</span>
            {(u.teams && u.teams.length > 0) && <span style={{ color: 'var(--cn-text-mute)' }}>·</span>}
            {dedupeUclOverlap(u.teams || []).map(t => <TeamPill key={t} code={t} size="sm" />)}
          </div>
          {u.bio && (
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--cn-text)', textWrap: 'pretty' }}>
              {u.bio}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 16, fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
            {u.city && <span>📍 {u.city}</span>}
            {u.joined && <span>{u.joined}</span>}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 18 }}>
            <Stat label="Posts" value={u.posts ?? 0} />
            <Stat label="Followers" value={u.followers ?? 0} />
            <Stat label="Following" value={u.following ?? 0} />
          </div>
          <FanCard teams={u.teams || []} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--cn-border)', marginTop: 8, position: 'sticky', top: 0, background: 'var(--cn-bg)', zIndex: 2 }}>
          {[
            { id: 'posts', label: 'Posts' },
            { id: 'plays', label: tweaks.playsLabel || 'Plays' },
            { id: 'media', label: 'Media' },
            { id: 'bookmarks', label: 'Saved' },
            { id: 'likes', label: 'Likes' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 0',
              background: 'transparent', border: 'none',
              color: tab === t.id ? 'var(--cn-text)' : 'var(--cn-text-mute)',
              fontFamily: 'var(--cn-font-body)', fontSize: 13, fontWeight: 600,
              borderBottom: tab === t.id ? '2px solid var(--cn-accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        <div>
          {tab === 'posts' && myPosts.slice(0, 6).map((p, i) => (
            <Post key={p.id || i} post={typeof p.user === 'string' ? { ...p, user: u } : p} />
          ))}
          {tab === 'plays' && (() => {
            const myPlays = (plays || []).filter(p => p.user?.id === u.id);
            if (!myPlays.length) {
              return (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
                  No plays yet. Tap + on the home screen to record one.
                </div>
              );
            }
            return (
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {myPlays.map(p => <ProfilePlayTile key={p.id} play={p} onOpen={onOpenPlay} onDelete={onDeletePlay} />)}
              </div>
            );
          })()}
          {tab === 'media' && (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {Array.from({ length: 6 }).map((_, i) => <PhotoPlaceholder key={i} hue={200 + i * 30} ratio={1} label="" />)}
            </div>
          )}
          {tab === 'bookmarks' && (
            bookmarks === null
              ? <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Loading…</div>
              : bookmarksErr
                ? <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>{bookmarksErr}</div>
                : bookmarks.length === 0
                  ? <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>No bookmarks yet. Tap the bookmark icon under any post to save it here.</div>
                  : bookmarks.map((p, i) => <Post key={p.id || i} post={p} />)
          )}
          {tab === 'likes' && <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Likes are private to you.</div>}
        </div>
      </div>
      <BottomNav active="profile" onChange={onNav} unreadMessages={unreadMessages} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--cn-font-display)',
        fontWeight: 'var(--cn-display-weight)',
        fontSize: 22, letterSpacing: 'var(--cn-display-spacing)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value.toLocaleString()}</div>
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function FanCard({ teams }) {
  const cleaned = dedupeUclOverlap(teams);
  // Collapse by default when a user follows a long list — keeps the
  // profile compact and lets visitors expand if they're curious.
  const [open, setOpen] = React.useState(cleaned.length <= 4);
  if (cleaned.length === 0) return null;
  return (
    <div style={{
      marginTop: 14,
      border: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg-elev)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none',
          color: 'inherit', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Fan card · {new Date().getFullYear()}
          </span>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>· {cleaned.length}</span>
        </span>
        <span style={{
          display: 'inline-flex', transition: 'transform 180ms',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px 14px' }}>
          {cleaned.map(code => {
            const t = resolveTeam(code);
            if (!t) return null;
            // Whole-row tap routes to the team's schedule when we know the
            // team's id (resolveTeam carries id when ESPN's roster has been
            // hydrated). Falls back to a static row otherwise.
            const interactive = !!(t.id && t.league);
            const openSchedule = () => {
              if (!interactive) return;
              window.dispatchEvent(new CustomEvent('cntrd:open-team-schedule', {
                detail: {
                  league: t.league, teamId: t.id, name: t.name,
                  primary: t.primary, code: t.code, logo: t.logo,
                },
              }));
            };
            return (
              <button
                key={code}
                type="button"
                onClick={openSchedule}
                disabled={!interactive}
                title={interactive ? `See ${t.name}'s schedule` : t.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: 'none', padding: 0,
                  color: 'inherit', textAlign: 'left',
                  cursor: interactive ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                <TeamLogo team={t} size={22} radius={4} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>{t.league}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Photo/clip preview slot for the composer. Renders a tap-to-pick state,
// a uploading state, or the chosen media with a clear (×) button.
function ComposerMediaSlot({ type, media, uploading, onPick, onClear }) {
  const ratio = type === 'clip' ? 16 / 9 : 4 / 5;
  const label = type === 'clip' ? 'Tap to choose a clip' : 'Tap to choose a photo';

  if (!media) {
    return (
      <button type="button" onClick={onPick} style={{
        width: '100%', aspectRatio: ratio, marginTop: 4,
        borderRadius: 14,
        border: '1.5px dashed var(--cn-border-s)',
        background: 'var(--cn-bg-elev)',
        color: 'var(--cn-text-dim)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, cursor: 'pointer',
        fontFamily: 'var(--cn-font-body)',
      }}>
        <Icon name={type === 'clip' ? 'video' : 'image'} size={28} sw={1.4} />
        <span style={{ fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>
          {type === 'clip' ? 'mp4 · mov · webm · 25 MB max' : 'jpg · png · gif · webp · 25 MB max'}
        </span>
      </button>
    );
  }

  const src = media.url || media.localPreview;
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      {media.kind === 'video' ? (
        <video src={src} controls playsInline style={{
          width: '100%', aspectRatio: ratio, borderRadius: 14,
          background: '#000', objectFit: 'cover', display: 'block',
        }} />
      ) : (
        <img src={src} alt="" style={{
          width: '100%', aspectRatio: ratio, borderRadius: 14,
          objectFit: 'cover', display: 'block',
        }} />
      )}
      {uploading && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'var(--cn-font-mono)', fontSize: 12, letterSpacing: 0.5,
        }}>UPLOADING…</div>
      )}
      <button type="button" onClick={onClear} title="Remove" style={{
        position: 'absolute', top: 8, right: 8,
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        border: 'none', cursor: 'pointer',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="x" size={14} stroke="#fff" />
      </button>
    </div>
  );
}

// ─── COMPOSER ─────────────────────────────────────────────────
function ComposerScreen({ tweaks, onNav, onPost, me, replyTo }) {
  const meUser = me || ME;
  // Hide UCL duplicates (e.g. Chelsea-EPL + Chelsea-UCL) so the user has
  // one obvious tag per club instead of two side-by-side that would
  // resolve to the same name.
  const meTeams = dedupeUclOverlap(
    (meUser.teams && meUser.teams.length) ? meUser.teams : ['LAL', 'NYG', 'ARS']
  );
  const isReply = !!replyTo?.id;
  const [text, setText] = React.useState('');
  const [type, setType] = React.useState('take');
  const [tag, setTag] = React.useState(meTeams[0]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [media, setMedia] = React.useState(null);     // { url, kind, localPreview, name }
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const max = 280;

  // Need *something* to post: text for take/rumor; either text or media for
  // photo/clip; text for poll (options skipped — backend just gets the prompt).
  const hasMedia = !!media?.url;
  const canSubmit = !!text.trim() || ((type === 'photo' || type === 'clip') && hasMedia);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                 // allow re-selecting the same file
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setMedia({ url: null, kind: type === 'clip' ? 'video' : 'image', localPreview, name: file.name });
    setUploading(true);
    setErr(null);
    API.uploadMedia(file)
      .then(({ url, kind }) => setMedia(m => ({ ...m, url, kind })))
      .catch(e => { setMedia(null); setErr(e.message || 'Upload failed'); })
      .finally(() => setUploading(false));
  };

  const submit = async () => {
    if (!canSubmit || busy || uploading) return;
    setBusy(true); setErr(null);
    try {
      const body = { content: text.trim(), type, tags: [tag] };
      if (type === 'photo' && media?.url) body.image = media.url;
      if (type === 'clip'  && media?.url) body.extra = { video_url: media.url };
      if (isReply) body.reply_to = replyTo.id;
      if (onPost) await onPost(body);
      setText(''); setMedia(null);
      onNav?.('home');
    } catch (e) {
      setErr(e.message || 'Failed to post');
    } finally {
      setBusy(false);
    }
  };

  // Reset attached media when switching to a type that doesn't take media.
  React.useEffect(() => {
    if (type !== 'photo' && type !== 'clip' && media) setMedia(null);
  }, [type]);   // eslint-disable-line
  const types = [
    { id: 'take',  icon: 'flame',  label: 'Take' },
    { id: 'photo', icon: 'image',  label: 'Photo' },
    { id: 'clip',  icon: 'video',  label: 'Clip' },
    { id: 'poll',  icon: 'poll',   label: 'Poll' },
    { id: 'rumor', icon: 'flash',  label: 'Rumor' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <button onClick={() => onNav?.('home')} style={{ background: 'transparent', border: 'none', color: 'var(--cn-text-dim)', fontSize: 14, fontFamily: 'var(--cn-font-body)', cursor: 'pointer' }}>Cancel</button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>{isReply ? 'REPLY' : 'NEW POST'}</span>
        <button onClick={submit} disabled={!canSubmit || busy || uploading} style={{ padding: '7px 14px', borderRadius: 999, background: canSubmit && !busy && !uploading ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)', color: canSubmit && !busy && !uploading ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)', border: 'none', fontWeight: 700, fontSize: 13, cursor: canSubmit && !busy && !uploading ? 'pointer' : 'not-allowed' }}>{busy ? 'Posting…' : uploading ? 'Uploading…' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {err && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--cn-danger) 18%, transparent)', color: 'var(--cn-danger)', fontSize: 12, fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
        {isReply && (
          <div style={{
            marginBottom: 12, padding: '10px 12px',
            border: '0.5px solid var(--cn-border-s)',
            background: 'var(--cn-bg-elev)',
            borderRadius: 10,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            {replyTo.user && <Avatar user={replyTo.user} size={28} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
                Replying to {replyTo.user?.username ? '@' + replyTo.user.username : 'post'}
              </div>
              {(replyTo.text || replyTo.content) && (
                <div style={{
                  marginTop: 4, fontSize: 13, color: 'var(--cn-text-dim)',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{replyTo.text || replyTo.content}</div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Avatar user={meUser} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {meTeams.map(t => {
                const team = resolveTeam(t);
                if (!team) return null;
                const selected = tag === t;
                // Show the team *name* so users with multiple teams sharing
                // the same code (Eagles + 76ers + Phillies + Flyers all use
                // "PHI") can tell their picks apart. Code becomes a small
                // prefix so the league context is still visible.
                return (
                  <button key={t} onClick={() => setTag(t)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: selected ? team.primary : 'transparent',
                    border: `0.5px solid ${selected ? team.primary : 'var(--cn-border-s)'}`,
                    color: selected ? pickContrast(team.primary) : 'var(--cn-text-dim)',
                    borderRadius: 999, padding: '4px 10px',
                    fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', maxWidth: '100%',
                  }} title={team.fullName || team.name}>
                    <span style={{
                      fontSize: 10,
                      opacity: 0.75,
                      fontFamily: 'var(--cn-font-mono)',
                      letterSpacing: 0.5,
                    }}>{team.code}</span>
                    <span style={{
                      whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis', maxWidth: 140,
                    }}>{team.name}</span>
                  </button>
                );
              })}
              <button style={{ background: 'transparent', border: '0.5px dashed var(--cn-border-s)', color: 'var(--cn-text-mute)', borderRadius: 999, padding: '3px 9px', fontSize: 11, cursor: 'pointer' }}>+ tag</button>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, max))}
              placeholder={(type === 'photo' || type === 'clip') ? "What's the take? (optional)" : "What's the take?"}
              style={{
                width: '100%', minHeight: 120, padding: 0,
                background: 'transparent', border: 'none', resize: 'none',
                outline: 'none', color: 'var(--cn-text)',
                fontFamily: 'var(--cn-font-body)', fontSize: 18, lineHeight: 1.4,
              }}
            />
            {(type === 'photo' || type === 'clip') && (
              <ComposerMediaSlot
                type={type}
                media={media}
                uploading={uploading}
                onPick={() => fileInputRef.current?.click()}
                onClear={() => setMedia(null)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={type === 'clip' ? 'video/*' : 'image/*'}
              onChange={pickFile}
              style={{ display: 'none' }}
            />

            {type === 'poll' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {['Option 1', 'Option 2'].map((o, i) => (
                  <input key={i} placeholder={o} style={{ background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)', borderRadius: 10, padding: '10px 12px', color: 'var(--cn-text)', fontFamily: 'var(--cn-font-body)', fontSize: 14, outline: 'none' }} />
                ))}
                <button style={{ alignSelf: 'flex-start', color: 'var(--cn-text-mute)', background: 'transparent', border: 'none', fontSize: 12, fontFamily: 'var(--cn-font-mono)', cursor: 'pointer' }}>+ Add option</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ borderTop: '0.5px solid var(--cn-border)', padding: '10px 16px', background: 'var(--cn-bg-elev2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {types.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                width: 38, height: 38, borderRadius: 10,
                background: type === t.id ? 'color-mix(in srgb, var(--cn-accent) 20%, transparent)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: type === t.id ? 'var(--cn-accent)' : 'var(--cn-text-mute)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={t.icon} size={20} sw={1.7} />
              </button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: text.length > max * 0.9 ? 'var(--cn-danger)' : 'var(--cn-text-mute)' }}>
            {max - text.length}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PLAYS CREATOR ────────────────────────────────────────────
// Hard limits for Plays media. Users get an inline error if they try to
// upload a clip longer than 30 seconds.
const PLAY_VIDEO_MAX_SEC = 30;
const PLAY_PHOTO_DURATION_MS = 10_000;

// Read a video file's duration in the browser before sending it up. Resolves
// to NaN if the file isn't a video or metadata can't be read.
async function getVideoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number(v.duration) || NaN);
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(NaN); };
    v.src = url;
  });
}

function PlaysCreatorScreen({ tweaks, onNav, onCreate, me }) {
  const meUser = me || ME;
  const meTeams = dedupeUclOverlap(
    (meUser.teams && meUser.teams.length) ? meUser.teams : ['LAL']
  );
  const [overlay, setOverlay] = React.useState(meTeams[0]);
  const [stickerKind, setStickerKind] = React.useState('score');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const overlayTeam = resolveTeam(overlay);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);

    // Enforce ≤30s on videos client-side. (File-size cap on the server is
    // 25 MB; that already implies short clips, but check duration too.)
    if (file.type.startsWith('video/')) {
      const dur = await getVideoDuration(file);
      if (Number.isFinite(dur) && dur > PLAY_VIDEO_MAX_SEC + 0.5) {
        setErr(`Video must be ${PLAY_VIDEO_MAX_SEC}s or shorter (this one is ${dur.toFixed(1)}s).`);
        return;
      }
    }

    setBusy(true);
    try {
      const { url, kind } = await window.API.uploadMedia(file);
      if (onCreate) {
        await onCreate({
          team_code: overlayTeam?.code || overlay,
          label: 'My ' + (overlayTeam?.name || 'play'),
          hue: meUser.avatarHue ?? 200,
          media_url: url,
          media_kind: kind,
        });
      }
      onNav?.('home');
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* fake camera viewport */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 40%, #1a2a3a 0%, #050810 70%)',
      }}>
        {/* fake "court" */}
        <div style={{
          position: 'absolute', left: '5%', right: '5%', top: '30%', bottom: '20%',
          background: 'linear-gradient(180deg, rgba(180,140,90,0.2) 0%, rgba(120,80,40,0.4) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          transform: 'perspective(800px) rotateX(45deg)',
          transformOrigin: 'bottom',
        }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3, background: 'radial-gradient(circle at 50% 30%, transparent 30%, rgba(0,0,0,0.6) 80%)' }} />
      </div>

      {/* top bar */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', zIndex: 2 }}>
        <button onClick={() => onNav?.('home')} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={20} stroke="#fff" />
        </button>
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: 999 }}>
          {['Photo', tweaks.playsLabel || 'Play', 'Live'].map((m, i) => (
            <span key={m} style={{ padding: '5px 12px', borderRadius: 999, background: i === 1 ? '#fff' : 'transparent', color: i === 1 ? '#000' : '#fff', fontWeight: 700, fontSize: 11, fontFamily: 'var(--cn-font-mono)', letterSpacing: 0.5 }}>{m.toUpperCase()}</span>
          ))}
        </div>
        <button style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="flash" size={18} stroke="#fff" />
        </button>
      </div>

      {/* live overlay sticker placed on the "court" */}
      {stickerKind === 'score' && (
        <div style={{
          position: 'absolute', top: '38%', left: 24,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: 10, zIndex: 3,
        }}>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: '#FF3B30', letterSpacing: 1, marginBottom: 4 }}>● LIVE · Q4 4:21</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: TEAMS.LAL.primary, color: '#fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LAL</div>
                <span style={{ fontFamily: 'var(--cn-font-display)', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>88</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: TEAMS.BOS.primary, color: '#fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>BOS</div>
                <span style={{ fontFamily: 'var(--cn-font-display)', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>91</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {stickerKind === 'tag' && overlayTeam && (
        <div style={{ position: 'absolute', top: '40%', left: 30, transform: 'rotate(-8deg)', padding: '6px 12px', background: overlayTeam.primary, color: pickContrast(overlayTeam.primary), fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 28, letterSpacing: 0.5, zIndex: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>GO {overlayTeam.code}</div>
      )}

      {/* sticker tray */}
      <div style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 3 }}>
        {[
          { id: 'score', icon: 'whistle', label: 'Score' },
          { id: 'tag', icon: 'flame', label: 'Tag' },
          { id: 'text', icon: 'text', label: 'Text' },
          { id: 'sticker', icon: 'sticker', label: 'Sticker' },
        ].map(s => (
          <button key={s.id} onClick={() => setStickerKind(s.id)} style={{
            width: 44, height: 44, borderRadius: '50%',
            background: stickerKind === s.id ? '#fff' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            border: '0.5px solid rgba(255,255,255,0.18)',
            color: stickerKind === s.id ? '#000' : '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={s.icon} size={18} stroke={stickerKind === s.id ? '#000' : '#fff'} />
          </button>
        ))}
      </div>

      {/* bottom: shutter + filmstrip */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, padding: '0 24px', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', backdropFilter: 'blur(10px)', cursor: 'pointer' }} />
          <button onClick={capture} disabled={busy} style={{ width: 72, height: 72, borderRadius: '50%', background: 'transparent', border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff' }} />
          </button>
          <button style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="repost" size={18} stroke="#fff" />
          </button>
        </div>
        <div style={{ textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 10, letterSpacing: 1 }}>
          {busy ? 'UPLOADING…' : `TAP TO PICK A PHOTO OR ≤${PLAY_VIDEO_MAX_SEC}s CLIP`}
        </div>
        {err && (
          <div style={{ marginTop: 6, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: '#FF6F61' }}>
            {err}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef} type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        onChange={onFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ─── PLAYS VIEWER ─────────────────────────────────────────────
function PlaysViewerScreen({ tweaks, onNav, plays, selectedPlay, me, onDeletePlay }) {
  const list = (plays && plays.length ? plays : PLAYS);
  const initialIdx = React.useMemo(() => {
    if (selectedPlay) {
      const i = list.findIndex(p => p.id === selectedPlay.id);
      if (i >= 0) return i;
    }
    return 0;
  }, [selectedPlay?.id, list.length]);

  const [idx, setIdx] = React.useState(initialIdx);
  const [progress, setProgress] = React.useState(0);   // 0..1 for the current play
  const videoRef = React.useRef(null);

  React.useEffect(() => { setIdx(initialIdx); }, [initialIdx]);

  const play = list[idx] || null;
  const u = play && (typeof play.user === 'string' ? USERS[play.user] : play.user);
  const team = play ? (TEAMS[play.team] || TEAMS.LAL) : TEAMS.LAL;
  const isMine = !!me && u && u.id === me.id;
  const isVideo = !!play && play.media_kind === 'video' && !!play.media_url;
  const hasMedia = !!play?.media_url;

  // Auto-advance: photos run on a 10s wall-clock; videos drive themselves.
  React.useEffect(() => {
    if (!play) return;
    setProgress(0);
    if (isVideo) return;                              // video updates progress via timeupdate
    const start = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - start) / PLAY_PHOTO_DURATION_MS;
      if (t >= 1) {
        clearInterval(id);
        setProgress(1);
        goNext();
      } else {
        setProgress(t);
      }
    }, 100);
    return () => clearInterval(id);
  }, [play?.id, isVideo]);

  const goNext = React.useCallback(() => {
    setIdx(i => {
      if (i >= list.length - 1) {
        // Last play — close the viewer.
        Promise.resolve().then(() => onNav?.('home'));
        return i;
      }
      return i + 1;
    });
  }, [list.length, onNav]);

  const goPrev = () => setIdx(i => Math.max(0, i - 1));

  if (!play) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
        No plays to show.
      </div>
    );
  }

  const remove = async () => {
    if (typeof confirm === 'function' && !confirm('Delete this Play permanently?')) return;
    try {
      await onDeletePlay?.(play.id);
      onNav?.('home');
    } catch (e) { alert(e.message || 'Failed to delete'); }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Tap zones: left half → previous, right half → next.
          z-index 1 sits above the gradient/media but below all UI controls.
          `bottom: 60` keeps the lower edge clear so a video's native
          controls bar (and the reply input) stay tappable. */}
      <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: 0, bottom: 60, width: '40%', zIndex: 1, cursor: 'pointer' }} />
      <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 0, bottom: 60, width: '40%', zIndex: 1, cursor: 'pointer' }} />

      {/* progress bars */}
      <div style={{ position: 'absolute', top: 56, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 5 }}>
        {list.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{
              width: i < idx ? '100%'
                  : i === idx ? Math.round(progress * 100) + '%'
                  : '0%',
              height: '100%', background: '#fff',
              transition: i === idx ? 'width 0.1s linear' : 'none',
            }} />
          </div>
        ))}
      </div>
      {/* user header */}
      <div style={{ position: 'absolute', top: 70, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10, zIndex: 5, color: '#fff' }}>
        <Avatar user={u} size={32} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>@{u.username}</span>
            <TeamPill code={play.team} size="xs" />
            {play.live && <span style={{ background: 'var(--cn-live)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '1.5px 5px', borderRadius: 3, fontFamily: 'var(--cn-font-mono)', letterSpacing: 0.5 }}>LIVE</span>}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'var(--cn-font-mono)' }}>{play.time}</div>
        </div>
        {isMine && (
          <button onClick={remove} title="Delete play" style={{
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
            border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: '50%',
            width: 32, height: 32, color: 'var(--cn-danger)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        )}
        <button onClick={() => onNav?.('home')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <Icon name="x" size={22} stroke="#fff" />
        </button>
      </div>

      {/* Background — real media if present, otherwise the team-tinted
          gradient that's been here since the design mock. */}
      {hasMedia ? (
        isVideo ? (
          <video
            key={play.id}                              // remount when play changes
            ref={videoRef}
            src={play.media_url}
            autoPlay muted playsInline controls
            controlsList="nodownload"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
            }}
            onEnded={goNext}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'contain', background: '#000',
            }}
          />
        ) : (
          <img src={play.media_url} alt={play.label || ''} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', background: '#000',
          }} />
        )
      ) : (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 50% 35%, ${team.accent}55 0%, ${team.primary}88 40%, #000 90%)`,
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,0.025) 22px 23px)' }} />
        </>
      )}

      {/* Caption overlay (big label) — keeps the design's brand even with
          real media underneath. */}
      <div style={{
        position: 'absolute', left: 24, right: 80, bottom: 110,
        fontFamily: 'var(--cn-font-display)', fontWeight: 800,
        fontSize: 32, lineHeight: 0.95,
        color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.6)',
        textTransform: 'uppercase',
        zIndex: 3, pointerEvents: 'none',
      }}>{play.label}.</div>

      {/* reactions */}
      <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 14, zIndex: 5 }}>
        {[
          { e: '🔥', n: '4.2k' },
          { e: '🏀', n: '1.8k' },
          { e: '😤', n: '912' },
          { e: '👀', n: '438' },
        ].map((r, i) => (
          <button key={i} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span>{r.e}</span>
            <span style={{ fontSize: 8, fontFamily: 'var(--cn-font-mono)' }}>{r.n}</span>
          </button>
        ))}
      </div>

      {/* reply bar */}
      <div style={{ position: 'absolute', bottom: 28, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, zIndex: 5 }}>
        <input placeholder={`Reply to ${u.username}...`} style={{
          flex: 1, padding: '11px 16px', borderRadius: 999,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
          border: '0.5px solid rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 13, outline: 'none',
          fontFamily: 'var(--cn-font-body)',
        }} />
        <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={16} stroke="#fff" />
        </button>
      </div>
    </div>
  );
}

// ─── USER PROFILE (someone else's profile) ────────────────────
// Reachable by tapping any user's avatar/name in the feed or in chat
// bubbles. Private accounts return a locked view; we render a placeholder
// with a Follow / Request to follow button.
function UserProfileScreen({ tweaks, onNav, me, viewUsername, unreadMessages = 0 }) {
  const [user, setUser] = React.useState(null);
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [tab, setTab] = React.useState('posts');
  const [busyFollow, setBusyFollow] = React.useState(false);

  const username = viewUsername;
  const isMe = !!(me?.username && username && me.username === username);

  React.useEffect(() => {
    if (!username) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(null);
    Promise.all([
      window.API.user(username).catch(e => { throw e; }),
      window.API.userPosts(username).catch(() => []),
    ]).then(([u, list]) => {
      if (cancelled) return;
      setUser(u);
      setPosts((list || []).map(window.normalizePost));
      setLoading(false);
    }).catch(e => {
      if (cancelled) return;
      setErr(e.message || 'Failed to load');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [username]);

  const followToggle = async () => {
    if (!user || busyFollow) return;
    setBusyFollow(true);
    try {
      const res = await window.API.followUser(user.username);
      // Backend returns { is_following, follower_count, request_pending }.
      setUser(prev => prev ? {
        ...prev,
        is_following:    typeof res.is_following === 'boolean' ? res.is_following    : !prev.is_following,
        request_pending: typeof res.request_pending === 'boolean' ? res.request_pending : prev.request_pending,
        follower_count:  typeof res.follower_count === 'number'  ? res.follower_count  : prev.follower_count,
      } : prev);
    } catch (e) {
      alert(e.message || 'Could not update follow');
    } finally {
      setBusyFollow(false);
    }
  };

  // Build a "view" object that ProfileScreen-style components can consume.
  const view = user ? {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    bio: user.bio || '',
    pronouns: user.pronouns || '',
    city: user.city || '',
    teams: Array.isArray(user.team_tags) ? user.team_tags : [],
    followers: user.follower_count ?? 0,
    following: user.following_count ?? 0,
    posts: user.post_count ?? 0,
    avatar: user.avatar,
    avatarHue: user.avatar_hue ?? 200,
    is_private: !!user.is_private,
    is_following: !!user.is_following,
    request_pending: !!user.request_pending,
    locked: !!user.is_private && !user.is_following && !isMe,
    joined: user.created_at
      ? 'Joined ' + new Date(user.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : '',
  } : null;

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')}><Icon name="chevron-l" size={22} stroke="var(--cn-text)" /></button>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)' }}>@{username || ''}</span>
        <span style={{ width: 32 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>{err}</div>
        ) : !view ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>User not found.</div>
        ) : (
          <>
            <div style={{ padding: '20px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
                <Avatar user={view} size={88} ring />
                {!isMe && (
                  <button
                    onClick={followToggle}
                    disabled={busyFollow}
                    style={{
                      padding: '8px 16px', borderRadius: 999,
                      background: view.is_following ? 'var(--cn-bg-elev2)' : view.request_pending ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
                      color:      view.is_following ? 'var(--cn-text)'    : view.request_pending ? 'var(--cn-text-dim)' : 'var(--cn-on-accent)',
                      border: view.is_following || view.request_pending ? '0.5px solid var(--cn-border)' : 'none',
                      fontWeight: 700, fontSize: 13, fontFamily: 'var(--cn-font-body)',
                      cursor: busyFollow ? 'wait' : 'pointer',
                    }}
                  >
                    {view.is_following ? 'Following' : view.request_pending ? 'Requested' : 'Follow'}
                  </button>
                )}
              </div>
              <div style={{
                fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
                textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
                fontSize: 24, lineHeight: 1.05,
              }}>{view.displayName}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)' }}>@{view.username}</span>
                {view.teams.length > 0 && <span style={{ color: 'var(--cn-text-mute)' }}>·</span>}
                {dedupeUclOverlap(view.teams).map(t => <TeamPill key={t} code={t} size="sm" />)}
              </div>
              {view.bio && (
                <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--cn-text)', textWrap: 'pretty' }}>
                  {view.bio}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', gap: 16, fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
                {view.city && <span>📍 {view.city}</span>}
                {view.joined && <span>{view.joined}</span>}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 18 }}>
                <Stat label="Posts" value={view.posts} />
                <Stat label="Followers" value={view.followers} />
                <Stat label="Following" value={view.following} />
              </div>
              {view.teams.length > 0 && <FanCard teams={view.teams} />}
            </div>

            {view.locked ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12, lineHeight: 1.6 }}>
                This account is private.<br />
                <span style={{ fontSize: 11 }}>Their posts and Plays are hidden until they accept your follow request.</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', borderBottom: '0.5px solid var(--cn-border)', marginTop: 8, position: 'sticky', top: 0, background: 'var(--cn-bg)', zIndex: 2 }}>
                  {[
                    { id: 'posts', label: 'Posts' },
                    { id: 'media', label: 'Media' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                      flex: 1, padding: '12px 0',
                      background: 'transparent', border: 'none',
                      color: tab === t.id ? 'var(--cn-text)' : 'var(--cn-text-mute)',
                      fontFamily: 'var(--cn-font-body)', fontSize: 13, fontWeight: 600,
                      borderBottom: tab === t.id ? '2px solid var(--cn-accent)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}>{t.label}</button>
                  ))}
                </div>
                <div>
                  {tab === 'posts' && (
                    posts.length === 0
                      ? <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>No posts yet.</div>
                      : posts.map((p, i) => <Post key={p.id || i} post={p} />)
                  )}
                  {tab === 'media' && (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
                      Photo + clip posts will surface here.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <BottomNav active={null} onChange={onNav} unreadMessages={unreadMessages} />
    </div>
  );
}

Object.assign(window, { ProfileScreen, ComposerScreen, PlaysCreatorScreen, PlaysViewerScreen, FanCard, UserProfileScreen });
