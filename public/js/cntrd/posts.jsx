// posts.jsx — feed item components for CNTRD
// Renders the different post types: take, photo, score, poll, clip, box, rumor.

// Wired by app.jsx to thread current-user info + action handlers down to
// every PostShell without prop-drilling. Defaults are no-ops.
const PostActionsContext = React.createContext({
  currentUserId: null,
  onPostUpdated: null,    // (updated) => void
  onPostDeleted: null,    // (id) => void
  onUserBlocked: null,    // (userId) => void
});

const EDIT_WINDOW_SEC = 30;
function secondsTilEditDeadline(post) {
  if (!post?.created_at) return 0;
  const t = Date.parse(String(post.created_at).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + EDIT_WINDOW_SEC * 1000 - Date.now()) / 1000));
}

function PostHeader({ user, time, tags, edited, postId, isMine, canEdit, editLabel, onEdit, onDelete, onBlock }) {
  const u = (typeof user === 'string')
    ? (USERS[user] || USERS.mike_b)
    : (user || USERS.mike_b);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Dismiss the dropdown on any outside click.
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, position: 'relative' }}>
      <Avatar user={u} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--cn-text)' }}>
            {u.displayName}
          </span>
          {u.verified && <Icon name="verified" size={13} stroke="var(--cn-accent)" />}
          {tags && tags.length > 0 && (
            <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
              {tags.slice(0, 3).map(t => <TeamPill key={t} code={t} size="xs" />)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>
          @{u.username} · {time}{edited ? ' · edited' : ''}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          style={iconBtnStyle()}
          aria-label="Post actions"
        >
          <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
        </button>
        {menuOpen && (
          <PostActionMenu
            isMine={isMine}
            canEdit={canEdit}
            editLabel={editLabel}
            onEdit={() => { setMenuOpen(false); onEdit?.(); }}
            onDelete={() => { setMenuOpen(false); onDelete?.(); }}
            onBlock={() => { setMenuOpen(false); onBlock?.(); }}
            otherUsername={u.username}
          />
        )}
      </div>
    </div>
  );
}

function PostActionMenu({ isMine, canEdit, editLabel, onEdit, onDelete, onBlock, otherUsername }) {
  const items = [];
  if (isMine && canEdit) items.push({ label: editLabel || 'Edit', onClick: onEdit });
  if (isMine)            items.push({ label: 'Delete post', danger: true, onClick: onDelete });
  if (!isMine)           items.push({ label: `Block @${otherUsername}`, danger: true, onClick: onBlock });
  if (!items.length)     items.push({ label: 'Nothing here yet', disabled: true });
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4,
        minWidth: 200,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
        borderRadius: 10,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {items.map((it, i) => (
        <button key={i} onClick={it.onClick} disabled={it.disabled} style={{
          display: 'block', width: '100%',
          padding: '10px 14px',
          background: 'transparent', border: 'none',
          color: it.disabled ? 'var(--cn-text-mute)' : (it.danger ? 'var(--cn-danger)' : 'var(--cn-text)'),
          fontSize: 13, fontWeight: 600, textAlign: 'left',
          cursor: it.disabled ? 'default' : 'pointer',
          fontFamily: 'var(--cn-font-body)',
          borderBottom: i < items.length - 1 ? '0.5px solid var(--cn-border)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  );
}

function iconBtnStyle() {
  return {
    width: 28, height: 28, borderRadius: 8,
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--cn-text-mute)',
  };
}

function PostFooter({ likes, replies, reposts, postId, initiallyLiked }) {
  const [liked, setLiked] = React.useState(!!initiallyLiked);
  const [n, setN] = React.useState(likes);
  const fmt = (k) => k >= 1000 ? (k / 1000).toFixed(1) + 'k' : k;
  const Btn = ({ icon, label, color, onClick, active }) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'transparent', border: 'none',
      color: active ? color : 'var(--cn-text-mute)',
      fontSize: 13, fontFamily: 'var(--cn-font-mono)',
      padding: '6px 4px', cursor: 'pointer',
    }}>
      <Icon name={icon} size={17} sw={1.6} />
      <span>{fmt(label)}</span>
    </button>
  );
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 12, marginRight: -4,
    }}>
      <Btn icon="reply" label={replies} />
      <Btn icon="repost" label={reposts} color="var(--cn-success)" />
      <Btn
        icon={liked ? 'heart-fill' : 'heart'}
        label={n}
        color="var(--cn-danger)"
        active={liked}
        onClick={async () => {
          const next = !liked;
          setLiked(next); setN(n + (next ? 1 : -1));
          if (postId && window.API && window.API.hasToken && window.API.hasToken()) {
            try {
              const r = await window.API.likePost(postId);
              if (typeof r.like_count === 'number') setN(r.like_count);
              if (typeof r.liked === 'boolean') setLiked(r.liked);
            } catch { /* mock post or offline — keep local toggle */ }
          }
        }}
      />
      <button style={{ ...iconBtnStyle(), color: 'var(--cn-text-mute)' }}>
        <Icon name="bookmark" size={17} sw={1.6} />
      </button>
      <button style={{ ...iconBtnStyle(), color: 'var(--cn-text-mute)' }}>
        <Icon name="share" size={17} sw={1.6} />
      </button>
    </div>
  );
}

function PostShell({ children, post }) {
  const { currentUserId, onPostUpdated, onPostDeleted, onUserBlocked } = React.useContext(PostActionsContext);
  const isMine = !!currentUserId && post.user?.id === currentUserId;

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(post.content || post.text || '');
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [secondsLeft, setSecondsLeft] = React.useState(() => secondsTilEditDeadline(post));

  // Tick every second so the menu auto-disables Edit when the window expires.
  React.useEffect(() => {
    setSecondsLeft(secondsTilEditDeadline(post));
    if (!isMine) return;
    const id = setInterval(() => {
      const left = secondsTilEditDeadline(post);
      setSecondsLeft(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [post.created_at, isMine]);

  const canEdit = isMine && secondsLeft > 0;

  const beginEdit = () => {
    setDraft(post.content || post.text || '');
    setErr(null);
    setEditing(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true); setErr(null);
    try {
      const updated = await window.API.editPost(post.id, draft);
      onPostUpdated?.(updated);
      setEditing(false);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (typeof confirm === 'function' && !confirm('Delete this post permanently?')) return;
    try {
      await window.API.deletePost(post.id);
      onPostDeleted?.(post.id);
    } catch (e) { alert(e.message || 'Delete failed'); }
  };
  const block = async () => {
    const handle = post.user?.username;
    if (!handle) return;
    if (typeof confirm === 'function' && !confirm(`Block @${handle}? You won't see their posts and they won't see yours.`)) return;
    try {
      await window.API.blockUser(handle);
      onUserBlocked?.(post.user.id);
    } catch (e) { alert(e.message || 'Block failed'); }
  };

  return (
    <article style={{
      padding: 'var(--cn-post-pad-v) var(--cn-post-pad-h)',
      background: 'var(--cn-bg)',
      borderBottom: '0.5px solid var(--cn-border)',
      color: 'var(--cn-text)',
      fontFamily: 'var(--cn-font-body)',
      fontSize: 'var(--cn-font-body-size)',
    }}>
      <PostHeader
        user={post.user} time={post.time} tags={post.tags}
        edited={!!post.edited_at}
        postId={post.id}
        isMine={isMine}
        canEdit={canEdit}
        editLabel={canEdit ? `Edit (${secondsLeft}s left)` : null}
        onEdit={beginEdit}
        onDelete={remove}
        onBlock={block}
      />
      {editing ? (
        <PostEditEditor
          draft={draft} onDraftChange={setDraft}
          secondsLeft={secondsLeft}
          saving={saving} err={err}
          onSave={save} onCancel={() => setEditing(false)}
        />
      ) : children}
      <PostFooter likes={post.likes} replies={post.replies} reposts={post.reposts} postId={post.id} initiallyLiked={post.liked} />
    </article>
  );
}

function PostEditEditor({ draft, onDraftChange, secondsLeft, saving, err, onSave, onCancel }) {
  const max = 280;
  return (
    <div style={{ marginLeft: 46 }}>
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value.slice(0, max))}
        autoFocus
        style={{
          width: '100%', minHeight: 80, padding: '10px 12px',
          background: 'var(--cn-bg-elev)',
          border: '0.5px solid var(--cn-border-s)',
          borderRadius: 10,
          color: 'var(--cn-text)',
          fontFamily: 'var(--cn-font-body)', fontSize: 15, lineHeight: 1.4,
          resize: 'vertical', outline: 'none',
        }}
      />
      {err && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          {secondsLeft}s left · {max - draft.length} chars
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={onCancel} style={{
          padding: '6px 12px', borderRadius: 999,
          background: 'transparent', color: 'var(--cn-text-dim)',
          border: '0.5px solid var(--cn-border-s)', cursor: 'pointer',
          fontWeight: 600, fontSize: 12, fontFamily: 'var(--cn-font-body)',
        }}>Cancel</button>
        <button onClick={onSave} disabled={saving || !draft.trim() || secondsLeft <= 0} style={{
          padding: '6px 14px', borderRadius: 999,
          background: saving || !draft.trim() || secondsLeft <= 0 ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
          color:      saving || !draft.trim() || secondsLeft <= 0 ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
          border: 'none',
          cursor: saving || !draft.trim() || secondsLeft <= 0 ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
        }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

// ─── TAKE ─────────────────────────────────────────────────────
function TakePost({ post }) {
  return (
    <PostShell post={post}>
      <div style={{
        fontSize: 16, lineHeight: 1.45, color: 'var(--cn-text)',
        textWrap: 'pretty', marginLeft: 46,
      }}>{post.text}</div>
    </PostShell>
  );
}

// ─── SCORE / LIVE GAME UPDATE ─────────────────────────────────
function ScorePost({ post }) {
  // post.extra may carry a game snapshot (homeTeam/awayTeam/scores/period/league/state).
  const snap = post.extra || {};
  const home = snap.homeTeam || (snap.home && TEAMS[snap.home]) || null;
  const away = snap.awayTeam || (snap.away && TEAMS[snap.away]) || null;
  const isLive = snap.state === 'live';
  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        {home && away && (
          <div style={{
            background: 'var(--cn-bg-elev)',
            border: '0.5px solid var(--cn-border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px',
              borderBottom: '0.5px solid var(--cn-border)',
              background: 'var(--cn-bg-elev2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isLive && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--cn-live)',
                    boxShadow: '0 0 0 3px rgba(255,59,48,0.18)',
                    animation: 'cn-pulse 1.5s ease-in-out infinite',
                  }} />
                )}
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, fontWeight: 700, color: isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', letterSpacing: 0.5 }}>
                  {isLive ? 'LIVE · ' : ''}{snap.period || ''}{snap.clock ? ' · ' + snap.clock : ''}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
                {snap.league}
              </span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <ScoreRow team={away} score={snap.awayScore} winner={Number(snap.awayScore) > Number(snap.homeScore)} />
              <div style={{ height: 8 }} />
              <ScoreRow team={home} score={snap.homeScore} winner={Number(snap.homeScore) > Number(snap.awayScore)} />
            </div>
          </div>
        )}
        {post.headline && (
          <div style={{
            marginTop: 10,
            fontSize: 16, lineHeight: 1.4,
            fontFamily: 'var(--cn-font-display)',
            fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)',
            letterSpacing: 'var(--cn-display-spacing)',
          }}>{post.headline}</div>
        )}
        {post.blurb && (
          <div style={{ marginTop: 4, fontSize: 14, color: 'var(--cn-text-dim)', lineHeight: 1.4 }}>
            {post.blurb}
          </div>
        )}
      </div>
    </PostShell>
  );
}

function ScoreRow({ team, score, winner }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: team.primary, color: pickContrast(team.primary),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        fontFamily: 'var(--cn-font-body)',
      }}>{team.code}</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: winner ? 700 : 500, opacity: winner ? 1 : 0.7 }}>
        {team.name}
      </div>
      <div style={{
        fontFamily: 'var(--cn-font-display)',
        fontSize: 26,
        fontWeight: 'var(--cn-display-weight)',
        letterSpacing: 'var(--cn-display-spacing)',
        opacity: winner ? 1 : 0.55,
        fontVariantNumeric: 'tabular-nums',
      }}>{score}</div>
    </div>
  );
}

// ─── PHOTO ────────────────────────────────────────────────────
function PhotoPost({ post }) {
  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        {post.text && <div style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 8 }}>{post.text}</div>}
        {post.image ? (
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: '0.5px solid var(--cn-border)',
            background: 'var(--cn-bg-elev)',
          }}>
            <img src={post.image} alt={post.caption || ''} loading="lazy" style={{
              width: '100%', maxHeight: 560, objectFit: 'cover', display: 'block',
            }} />
            {post.caption && (
              <div style={{
                padding: '8px 12px', fontFamily: 'var(--cn-font-mono)',
                fontSize: 11, color: 'var(--cn-text-dim)',
                borderTop: '0.5px solid var(--cn-border)',
              }}>{post.caption}</div>
            )}
          </div>
        ) : (
          <PhotoPlaceholder caption={post.caption} hue={250} />
        )}
      </div>
    </PostShell>
  );
}

function PhotoPlaceholder({ caption, hue = 200, ratio = 4/5, label = 'photo' }) {
  return (
    <div style={{
      width: '100%', aspectRatio: ratio,
      borderRadius: 14, overflow: 'hidden',
      position: 'relative',
      background: `repeating-linear-gradient(135deg, oklch(0.30 0.04 ${hue}) 0 12px, oklch(0.26 0.04 ${(hue+30)%360}) 12px 24px)`,
      border: '0.5px solid var(--cn-border)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: 'var(--cn-font-mono)',
        fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
      }}>[ {label} ]</div>
      {caption && (
        <div style={{
          position: 'absolute', left: 12, bottom: 12, right: 12,
          fontFamily: 'var(--cn-font-mono)',
          fontSize: 11, color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>{caption}</div>
      )}
    </div>
  );
}

// ─── POLL ─────────────────────────────────────────────────────
function PollPost({ post }) {
  const [voted, setVoted] = React.useState(null);
  const [opts, setOpts] = React.useState(post.options);
  const total = opts.reduce((s, o) => s + o.votes, 0);

  const vote = (i) => {
    if (voted != null) return;
    const next = opts.map((o, idx) => ({ ...o, votes: idx === i ? o.votes + 1 : o.votes }));
    setOpts(next);
    setVoted(i);
  };

  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        <div style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 12 }}>{post.text}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {opts.map((o, i) => {
            const pct = voted != null ? Math.round((o.votes / total) * 100) : null;
            const isPicked = voted === i;
            return (
              <button key={i} onClick={() => vote(i)} style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                border: `0.5px solid ${isPicked ? 'var(--cn-accent)' : 'var(--cn-border-s)'}`,
                background: 'var(--cn-bg-elev)',
                borderRadius: 10,
                color: 'var(--cn-text)',
                fontFamily: 'var(--cn-font-body)',
                fontSize: 14,
                cursor: voted == null ? 'pointer' : 'default',
                overflow: 'hidden',
              }}>
                {pct != null && (
                  <span style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: pct + '%',
                    background: isPicked ? 'color-mix(in srgb, var(--cn-accent) 22%, transparent)' : 'rgba(255,255,255,0.05)',
                    transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)',
                  }} />
                )}
                <span style={{ position: 'relative', zIndex: 1, fontWeight: isPicked ? 700 : 500 }}>{o.label}</span>
                <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--cn-font-mono)', fontSize: 12, opacity: 0.7 }}>
                  {pct != null ? pct + '%' : '—'}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>
          {total.toLocaleString()} votes · {voted != null ? 'you voted' : 'tap to vote'}
        </div>
      </div>
    </PostShell>
  );
}

// ─── CLIP (video) ─────────────────────────────────────────────
function ClipPost({ post }) {
  const videoUrl = post.video_url || post.extra?.video_url;
  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        {post.text && <div style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 8 }}>{post.text}</div>}
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            style={{
              width: '100%', borderRadius: 14, background: '#000',
              maxHeight: 560, display: 'block',
              border: '0.5px solid var(--cn-border)',
            }}
          />
        ) : (
          <div style={{
            position: 'relative', borderRadius: 14, overflow: 'hidden',
            aspectRatio: 16/9,
            background: 'linear-gradient(135deg, #1a3a1f 0%, #0d1f12 60%, #1a3a1f 100%)',
            border: '0.5px solid var(--cn-border)',
          }}>
            {/* mock pitch lines */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.16, background: 'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.4) 18px 19px)' }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                border: '1.5px solid rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            {post.duration && (
              <div style={{
                position: 'absolute', right: 10, bottom: 10,
                padding: '3px 7px', borderRadius: 4,
                background: 'rgba(0,0,0,0.7)',
                fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: '#fff',
              }}>{post.duration}</div>
            )}
          </div>
        )}
      </div>
    </PostShell>
  );
}

// ─── BOX SCORE ────────────────────────────────────────────────
function BoxPost({ post }) {
  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        <div style={{
          background: 'var(--cn-bg-elev)',
          border: '0.5px solid var(--cn-border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '0.5px solid var(--cn-border)',
            background: 'var(--cn-bg-elev2)',
            fontFamily: 'var(--cn-font-display)',
            fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)',
            letterSpacing: 'var(--cn-display-spacing)',
            fontSize: 15,
          }}>{post.headline}</div>
          <div>
            {post.leaders.map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--cn-border)',
              }}>
                <TeamPill code={l.team} size="sm" />
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                <div style={{
                  fontFamily: 'var(--cn-font-mono)', fontSize: 11,
                  color: 'var(--cn-text-dim)', fontVariantNumeric: 'tabular-nums',
                }}>{l.line}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PostShell>
  );
}

// ─── RUMOR ────────────────────────────────────────────────────
function RumorPost({ post }) {
  return (
    <PostShell post={post}>
      <div style={{ marginLeft: 46 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 8,
          padding: '3px 8px', borderRadius: 4,
          background: 'color-mix(in srgb, var(--cn-accent) 18%, transparent)',
          color: 'var(--cn-accent)',
          fontFamily: 'var(--cn-font-mono)',
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
        }}>
          <Icon name="flame" size={11} sw={2} /> rumor mill
        </div>
        <div style={{
          fontSize: 16, lineHeight: 1.45,
          fontFamily: 'var(--cn-font-body)',
          borderLeft: '2px solid var(--cn-accent)',
          paddingLeft: 12, marginLeft: -2,
          textWrap: 'pretty',
        }}>{post.text}</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>
          {post.source}
        </div>
      </div>
    </PostShell>
  );
}

// ─── DISPATCH ─────────────────────────────────────────────────
function Post({ post }) {
  switch (post.type) {
    case 'take':  return <TakePost post={post} />;
    case 'score': return <ScorePost post={post} />;
    case 'photo': return <PhotoPost post={post} />;
    case 'poll':  return <PollPost post={post} />;
    case 'clip':  return <ClipPost post={post} />;
    case 'box':   return <BoxPost post={post} />;
    case 'rumor': return <RumorPost post={post} />;
    default:      return null;
  }
}

Object.assign(window, {
  Post, PostShell, PostHeader, PostFooter,
  TakePost, ScorePost, PhotoPost, PollPost, ClipPost, BoxPost, RumorPost,
  PhotoPlaceholder,
  PostActionsContext,
});
