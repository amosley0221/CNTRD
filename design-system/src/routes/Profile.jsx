import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, Avatar, Pill } from '../components';
import { users as usersApi, posts as postsApi } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Profile() {
  const { username: param } = useParams();
  const { me } = useAuth();
  const nav = useNavigate();
  const username = param || me?.username;
  const isMe = !!me && username === me.username;

  const [profile, setProfile] = useState(null);
  const [posts,   setPosts]   = useState(null);
  const [err,     setErr]     = useState(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [following_, setFollowingCount] = useState(0);
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
        if (!cancel) {
          setProfile(p);
          setPosts(posts);
          setFollowing(!!p.is_following);
          setFollowers(p.follower_count ?? p.followers ?? 0);
          setFollowingCount(p.following_count ?? p.following ?? 0);
        }
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

  return (
    <>
      <Eyebrow>Profile</Eyebrow>
      <div className="flex items-start gap-4 mb-6">
        <div style={{ width: 72, height: 72 }}>
          <Avatar initial={(display[0] || '?').toUpperCase()} />
        </div>
        <div className="flex-1">
          <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {display}
          </h1>
          <div style={{ fontFamily: fonts.mono, fontSize: 12, color: c.inkDim, letterSpacing: '0.05em', marginTop: 4 }}>
            @{profile.username}{profile.city ? ` · ${profile.city}` : ''}
          </div>
        </div>
        <div>
          {isMe ? (
            <button onClick={() => nav('/me/edit')} style={btn(c.accent, c.paper)}>EDIT PROFILE</button>
          ) : me ? (
            <button onClick={toggleFollow} disabled={followBusy} style={following ? btn('transparent', c.ink, { border: `1px solid ${c.inkFaint}` }) : btn(c.accent, c.paper)}>
              {followBusy ? '…' : following ? 'FOLLOWING' : 'FOLLOW'}
            </button>
          ) : null}
        </div>
      </div>

      {profile.bio && (
        <p style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 1.55, color: c.inkSoft, marginBottom: 24, maxWidth: 640 }}>
          {profile.bio}
        </p>
      )}

      <div className="flex gap-6 mb-8" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>
        <Stat label="POSTS"     value={posts?.length ?? 0} />
        <Stat label="FOLLOWERS" value={followers} />
        <Stat label="FOLLOWING" value={following_} />
      </div>

      {Array.isArray(profile.team_tags) && profile.team_tags.length > 0 && (
        <div className="mb-10">
          <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 8 }}>FAVORITE TEAMS</div>
          <div className="flex flex-wrap gap-2">
            {profile.team_tags.map((t) => <Pill key={t}>{String(t).replace(':', ' · ')}</Pill>)}
          </div>
        </div>
      )}

      <SectionHead title="Recent" italicWord="takes" count={posts ? `${posts.length}` : '…'} />
      {posts && posts.length === 0 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>No posts yet.</div>
      )}
      <div style={{ maxWidth: 640 }}>
        {posts?.map((p) => (
          <Link key={p.id} to={`/post/${p.id}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none', borderBottom: `1px solid ${c.line}`, padding: '14px 0' }}>
            <div style={{ fontFamily: fonts.display, fontSize: 17, lineHeight: 1.4, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
              {p.content || p.text}
            </div>
            <div className="mt-2 flex gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
              <span>{p.likes || 0} ♥</span>
              <span>{p.replies || 0} ↳</span>
              <span>{p.reposts || 0} ↻</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: fonts.display, fontWeight: 300, fontSize: 28, color: c.ink, lineHeight: 1 }}>{value}</span>
      <span style={{ marginTop: 4 }}>{label}</span>
    </div>
  );
}

function btn(bg, color, extra) {
  return {
    background: bg, color, border: 'none', cursor: 'pointer',
    padding: '10px 16px',
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    ...(extra || {}),
  };
}
