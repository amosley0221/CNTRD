// mobile-screens.jsx — remaining mobile screens for CNTRD
// profile, composer, plays creator, plays viewer, signup, login, settings, gameday chat

// ─── PROFILE ──────────────────────────────────────────────────
function ProfileScreen({ tweaks, onNav, me, posts }) {
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
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid var(--cn-border)' }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')}><Icon name="chevron-l" size={22} stroke="var(--cn-text)" /></button>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-dim)' }}>@{u.username}</span>
        <button style={iconBtnStyle()} onClick={() => onNav?.('settings')}><Icon name="settings" size={20} stroke="var(--cn-text)" /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
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
            {(u.teams || []).map(t => <TeamPill key={t} code={t} size="sm" />)}
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
          {tab === 'plays' && (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {Array.from({ length: 9 }).map((_, i) => {
                const t = resolveTeam(teams[i % teams.length]) || coverFrom;
                return (
                  <div key={i} style={{
                    aspectRatio: 9/16, borderRadius: 6, overflow: 'hidden',
                    background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                    display: 'flex', alignItems: 'flex-end', padding: 6,
                    fontFamily: 'var(--cn-font-mono)', fontSize: 9,
                    color: '#fff',
                  }}>{i + 1}d</div>
                );
              })}
            </div>
          )}
          {tab === 'media' && (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {Array.from({ length: 6 }).map((_, i) => <PhotoPlaceholder key={i} hue={200 + i * 30} ratio={1} label="" />)}
            </div>
          )}
          {tab === 'likes' && <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Likes are private to you.</div>}
        </div>
      </div>
      <BottomNav active="profile" onChange={onNav} />
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
  return (
    <div style={{
      marginTop: 14, padding: 14,
      border: '0.5px solid var(--cn-border)',
      background: 'var(--cn-bg-elev)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>Fan card · 2026</span>
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-accent)', letterSpacing: 1 }}>#0427</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {teams.map(code => {
          const t = resolveTeam(code);
          if (!t) return null;
          return (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 4, background: t.primary, color: pickContrast(t.primary), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{t.code}</div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{t.name}</span>
              <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>{t.league} · ride or die</span>
            </div>
          );
        })}
      </div>
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
function ComposerScreen({ tweaks, onNav, onPost, me }) {
  const meUser = me || ME;
  const meTeams = (meUser.teams && meUser.teams.length) ? meUser.teams : ['LAL', 'NYG', 'ARS'];
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
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>NEW POST</span>
        <button onClick={submit} disabled={!canSubmit || busy || uploading} style={{ padding: '7px 14px', borderRadius: 999, background: canSubmit && !busy && !uploading ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)', color: canSubmit && !busy && !uploading ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)', border: 'none', fontWeight: 700, fontSize: 13, cursor: canSubmit && !busy && !uploading ? 'pointer' : 'not-allowed' }}>{busy ? 'Posting…' : uploading ? 'Uploading…' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {err && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--cn-danger) 18%, transparent)', color: 'var(--cn-danger)', fontSize: 12, fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <Avatar user={meUser} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {meTeams.map(t => {
                const team = resolveTeam(t);
                if (!team) return null;
                const selected = tag === t;
                return (
                  <button key={t} onClick={() => setTag(t)} style={{
                    background: selected ? team.primary : 'transparent',
                    border: `0.5px solid ${selected ? team.primary : 'var(--cn-border-s)'}`,
                    color: selected ? pickContrast(team.primary) : 'var(--cn-text-dim)',
                    borderRadius: 999, padding: '3px 9px',
                    fontSize: 11, fontWeight: 700,
                    cursor: 'pointer',
                  }}>{team.code}</button>
                );
              })}
              <button style={{ background: 'transparent', border: '0.5px dashed var(--cn-border-s)', color: 'var(--cn-text-mute)', borderRadius: 999, padding: '3px 9px', fontSize: 11, cursor: 'pointer' }}>+ tag</button>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, max))}
              placeholder="What's the take?"
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
function PlaysCreatorScreen({ tweaks, onNav, onCreate, me }) {
  const meUser = me || ME;
  const meTeams = (meUser.teams && meUser.teams.length) ? meUser.teams : ['LAL'];
  const [overlay, setOverlay] = React.useState(meTeams[0]);
  const [stickerKind, setStickerKind] = React.useState('score');
  const [busy, setBusy] = React.useState(false);
  const overlayTeam = resolveTeam(overlay);
  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (onCreate) {
        await onCreate({
          team_code: overlayTeam?.code || overlay,
          label: 'My ' + (overlayTeam?.name || 'play'),
          hue: meUser.avatarHue ?? 200,
        });
      }
      onNav?.('home');
    } catch { /* swallow; already navigated for mock */ }
    finally { setBusy(false); }
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
          HOLD TO RECORD A {tweaks.playsLabel?.toUpperCase() || 'PLAY'}
        </div>
      </div>
    </div>
  );
}

// ─── PLAYS VIEWER ─────────────────────────────────────────────
function PlaysViewerScreen({ tweaks, onNav, plays }) {
  const list = (plays && plays.length ? plays : PLAYS);
  const idx = Math.min(1, list.length - 1);
  const play = list[Math.max(0, idx)];
  if (!play) return null;
  const u = (typeof play.user === 'string') ? USERS[play.user] : play.user;
  const team = TEAMS[play.team] || TEAMS.LAL;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* progress bars */}
      <div style={{ position: 'absolute', top: 56, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 5 }}>
        {list.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <div style={{
              width: i < idx ? '100%' : i === idx ? '54%' : '0%',
              height: '100%', background: '#fff',
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
        <button onClick={() => onNav?.('home')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <Icon name="x" size={22} stroke="#fff" />
        </button>
      </div>

      {/* simulated content: stadium-tinted */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 35%, ${team.accent}55 0%, ${team.primary}88 40%, #000 90%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,0.025) 22px 23px)' }} />

      {/* big play caption */}
      <div style={{
        position: 'absolute', left: 24, right: 80, top: '45%',
        fontFamily: 'var(--cn-font-display)', fontWeight: 800,
        fontSize: 38, lineHeight: 0.95,
        color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.5)',
        textTransform: 'uppercase',
      }}>{play.label}.</div>
      <div style={{ position: 'absolute', left: 24, top: 'calc(45% + 100px)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 }}>
        TD GARDEN · BOS vs LAL · Q4 4:21
      </div>

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

Object.assign(window, { ProfileScreen, ComposerScreen, PlaysCreatorScreen, PlaysViewerScreen, FanCard });
