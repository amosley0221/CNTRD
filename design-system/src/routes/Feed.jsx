import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle as MsgIcon } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, GameCard, Avatar } from '../components';
import { posts as postsApi, games as gamesApi } from '../api';
import { useAuth } from '../auth/AuthContext';

const LEAGUE_COLORS = {
  NFL: '#013369', NBA: '#c8102e', MLB: '#002d72', NHL: '#000000',
  EPL: '#37003c', MLS: '#001e62', NCAAF: '#a32035', NCAAB: '#a32035',
};

function teamMark(g, side /* 'home' | 'away' */) {
  const name = side === 'home' ? (g.home_name || g.home || '') : (g.away_name || g.away || '');
  const code = (side === 'home' ? g.home_abbr : g.away_abbr) || name.slice(0, 3).toUpperCase();
  const color = (side === 'home' ? g.home_color : g.away_color) || LEAGUE_COLORS[g.league] || '#444';
  return { code, color, name };
}

function gameToCardProps(g) {
  const isLive   = g.status === 'in' || g.state === 'in';
  const isFinal  = g.status === 'post' || g.state === 'post';
  const state    = isLive ? 'LIVE' : isFinal ? 'FINAL' : 'UPCOMING';
  const home = teamMark(g, 'home');
  const away = teamMark(g, 'away');
  const homeScore = Number(g.home_score ?? 0);
  const awayScore = Number(g.away_score ?? 0);
  const homeLead = homeScore > awayScore;
  const awayLead = awayScore > homeScore;
  return {
    state,
    league: g.league || '',
    status: g.status_detail || g.detail || g.clock || (isFinal ? 'FT' : isLive ? 'LIVE' : (g.kickoff_label || '')),
    away: { ...away, score: String(awayScore), lead: awayLead, odds: g.away_odds || '' },
    home: { ...home, score: String(homeScore), lead: homeLead, odds: g.home_odds || '' },
    foot1: g.venue || g.broadcast || '',
    foot2: g.network || '',
  };
}

export default function Feed() {
  const { me } = useAuth();
  const [posts, setPosts] = useState(null);
  const [postsErr, setPostsErr] = useState(null);
  const [games, setGames] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await (me ? postsApi.feed() : postsApi.explore());
        if (!cancel) setPosts(data || []);
      } catch (e) {
        if (!cancel) setPostsErr(e.message);
      }
    })();
    (async () => {
      try {
        const data = await gamesApi.all();
        if (!cancel) setGames(data || { live: [], upcoming: [], recent: [] });
      } catch {
        if (!cancel) setGames({ live: [], upcoming: [], recent: [] });
      }
    })();
    return () => { cancel = true; };
  }, [me?.id]);

  const live    = (games?.live    || []).slice(0, 4);
  const recent  = (games?.recent  || []).slice(0, 4);

  return (
    <>
      <Eyebrow>Today’s board</Eyebrow>

      {live.length > 0 && (
        <section className="mb-12">
          <SectionHead title="Live" italicWord="now" count={`${live.length}`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {live.map((g, i) => <GameCard key={g.id || i} {...gameToCardProps(g)} />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mb-12">
          <SectionHead title="Recent" italicWord="finals" count={`${recent.length}`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recent.map((g, i) => <GameCard key={g.id || i} {...gameToCardProps(g)} />)}
          </div>
        </section>
      )}

      <section className="mb-12">
        <SectionHead title="The" italicWord="feed" count={me ? 'PEOPLE YOU FOLLOW' : 'EXPLORE'} />
        {postsErr && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, letterSpacing: '0.05em', marginBottom: 12 }}>
            Could not load posts: {postsErr}
          </div>
        )}
        {!posts && !postsErr && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>LOADING…</div>
        )}
        {posts && posts.length === 0 && (
          <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, lineHeight: 1.5, padding: '24px 0' }}>
            Nothing here yet. Follow some accounts or be the first to post.
          </div>
        )}
        <div style={{ maxWidth: 640 }}>
          {posts && posts.map((p) => <RealPost key={p.id} post={p} />)}
        </div>
      </section>
    </>
  );
}

function RealPost({ post }) {
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.likes || 0);
  const u = post.user || {};
  const handle = u.username ? `@${u.username}` : '@anon';
  const display = u.displayName || u.username || 'anon';
  const initial = (display[0] || '?').toUpperCase();
  const time = relTime(post.created_at);

  const toggle = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try { await postsApi.like(post.id); } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  return (
    <article className="py-6 flex flex-col gap-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-2.5">
        <Link to={`/u/${u.username}`}><Avatar initial={initial} /></Link>
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{display}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>{handle}</div>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
      </div>

      <div style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.35, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
        {post.content || post.text}
      </div>

      {post.image && (
        <img
          src={post.image}
          alt=""
          style={{ borderRadius: 4, maxHeight: 480, objectFit: 'cover', width: '100%', border: `1px solid ${c.line}` }}
          loading="lazy"
        />
      )}

      <div className="flex gap-6 mt-1" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
        <button onClick={toggle} className="flex items-center gap-1.5"
          style={{ color: liked ? c.accent : c.inkDim, background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Heart size={13} fill={liked ? c.accent : 'none'} />{likes.toLocaleString()}
        </button>
        <span className="flex items-center gap-1.5"><Repeat2 size={13} /> {post.reposts || 0}</span>
        <span className="flex items-center gap-1.5"><MsgIcon size={13} /> {post.replies || 0}</span>
      </div>
    </article>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return `${Math.max(1, Math.round(diff))}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
