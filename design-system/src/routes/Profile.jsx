import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, Avatar, Pill } from '../components';
import { users as usersApi, posts as postsApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Reveal, CountUp } from '../hooks/useReveal';

export default function Profile() {
  const { username: param } = useParams();
  const { me } = useAuth();
  const nav = useNavigate();
  const username = param || me?.username;
  const isMe = !!me && username === me.username;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancel = false;
    (async () => {
      try {
        const [p, posts] = await Promise.all([
          usersApi.profile(username),
          postsApi.byUser(username).catch(() => []),
        ]);
        if (cancel) return;
        setProfile(p);
        setPosts(posts);
        setFollowing(!!p.is_following);
        setFollowers(p.follower_count ?? p.followers ?? 0);
        setFollowingCount(p.following_count ?? p.following ?? 0);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [username]);

  const toggleFollow = async () => {
    if (followBusy || !profile) return;
    setFollowBusy(true);
    try {
      const res = await usersApi.follow(profile.username);
      setFollowing(!!res.following || !!res.is_following);
      if (Number.isFinite(res.follower_count)) setFollowers(res.follower_count);
    } catch (e) {
      setErr(e.message);
    } finally {
      setFollowBusy(false);
    }
  };

  if (!username) return <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft }}>Sign in to see your profile.</div>;
  if (err) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>{err}</div>;
  if (!profile) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>LOADING…</div>;

  const display = profile.display_name || profile.displayName || profile.username;
  const [first, ...rest] = display.split(' ');
  const last = rest.join(' ');

  // Watermark glyph behind the headline — first 2 chars of the username
  // for users without a numeric ID. Matches the "23" jersey on the mock.
  const mark = (profile.username || '?').slice(0, 2).toUpperCase();
  const postCount = posts?.length ?? 0;

  return (
    <>
      {/* WATERMARK + HERO */}
      <section
        className="mb-12"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 32, borderBottom: `1px solid ${c.line}`, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20 }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -20, top: '50%', transform: 'translateY(-50%)',
            fontFamily: fonts.display, fontWeight: 200,
            fontSize: 'clamp(180px, 42vw, 380px)',
            lineHeight: 0.8, letterSpacing: '-0.08em',
            color: 'rgba(26, 22, 18, 0.05)',
            pointerEvents: 'none', userSelect: 'none',
            zIndex: 0,
          }}
        >
          {mark}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Reveal>
            <div className="flex items-center gap-3 mb-6" style={{ color: c.accent, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              <span className="block" style={{ width: 30, height: 1, background: c.accent }} />
              {profile.city || 'Profile'}{profile.pronouns ? ` · ${profile.pronouns}` : ''}
            </div>
          </Reveal>

          <Reveal>
            <h1
              className="fraunces-soft"
              style={{
                fontFamily: fonts.display, fontWeight: 300,
                fontSize: 'clamp(48px, 12vw, 110px)',
                lineHeight: 0.9, letterSpacing: '-0.05em', margin: 0,
              }}
            >
              <span style={{ display: 'block' }}>{first}</span>
              {last && (
                <span style={{ display: 'block', fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>
                  {last}
                </span>
              )}
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <div style={{ fontFamily: fonts.mono, fontSize: 12, color: c.inkDim, letterSpacing: '0.05em', marginTop: 12 }}>
              @{profile.username}
            </div>
          </Reveal>

          {profile.bio && (
            <Reveal delay={200}>
              <p style={{ fontFamily: fonts.display, fontStyle: 'italic', fontWeight: 300, fontSize: 20, color: c.inkSoft, marginTop: 18, maxWidth: 560 }}>
                {profile.bio}
              </p>
            </Reveal>
          )}

          {/* VITALS */}
          <Reveal delay={280}>
            <div className="grid mt-9" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 24px', maxWidth: 560 }}>
              <Vital label="POSTS"     value={postCount} />
              <Vital label="FOLLOWERS" value={followers} />
              <Vital label="FOLLOWING" value={followingCount} />
              <Vital label="JOINED" value={joinedShort(profile.created_at)} animateNumber={false} />
            </div>
          </Reveal>

          {/* ACTIONS */}
          <Reveal delay={360}>
            <div className="flex gap-3 mt-8">
              {isMe ? (
                <button onClick={() => nav('/me/edit')} style={btn(c.accent, c.paper)}>EDIT PROFILE</button>
              ) : me ? (
                <button onClick={toggleFollow} disabled={followBusy} style={following ? btn('transparent', c.ink, { border: `1px solid ${c.inkFaint}` }) : btn(c.accent, c.paper)}>
                  {followBusy ? '…' : following ? 'FOLLOWING' : '＋ FOLLOW'}
                </button>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/* TEAM TAGS */}
      {Array.isArray(profile.team_tags) && profile.team_tags.length > 0 && (
        <Reveal>
          <div className="mb-10">
            <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 8 }}>FAVORITE TEAMS</div>
            <div className="flex flex-wrap gap-2">
              {profile.team_tags.map((t) => <Pill key={t}>{String(t).replace(':', ' · ')}</Pill>)}
            </div>
          </div>
        </Reveal>
      )}

      {/* RECENT TAKES */}
      <SectionHead title="Recent" italicWord="takes" count={posts ? `${posts.length}` : '…'} />
      {posts && posts.length === 0 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>No posts yet.</div>
      )}
      <div style={{ maxWidth: 640 }}>
        {posts?.map((p) => (
          <Reveal key={p.id}>
            <Link to={`/post/${p.id}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none', borderBottom: `1px solid ${c.line}`, padding: '14px 0' }}>
              <div style={{ fontFamily: fonts.display, fontSize: 17, lineHeight: 1.4, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
                {p.content || p.text}
              </div>
              <div className="mt-2 flex gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
                <span>{p.likes || 0} ♥</span>
                <span>{p.replies || 0} ↳</span>
                <span>{p.reposts || 0} ↻</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}

function Vital({ label, value, animateNumber = true }) {
  const isNumeric = animateNumber && typeof value === 'number';
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontFamily: fonts.mono, fontSize: 9.5, color: c.inkDim, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: c.ink }}>
        {isNumeric ? <CountUp value={value} /> : value}
      </span>
    </div>
  );
}

function joinedShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', year: 'numeric' }).toUpperCase();
}

function btn(bg, color, extra) {
  return {
    background: bg, color, border: extra?.border || 'none', cursor: 'pointer',
    padding: '12px 18px',
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    ...(extra || {}),
  };
}
