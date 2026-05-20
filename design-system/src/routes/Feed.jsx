import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle as MsgIcon, Plus } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, SectionHead, GameCard, Avatar } from '../components';
import { posts as postsApi, games as gamesApi, plays as playsApi } from '../api';
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
  const [plays, setPlays] = useState([]);
  const [articles, setArticles] = useState(null);

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
    (async () => {
      try {
        const data = await playsApi.list();
        if (!cancel) setPlays(data || []);
      } catch {
        if (!cancel) setPlays([]);
      }
    })();
    (async () => {
      try {
        const leagues = Array.isArray(me?.followed_leagues) ? me.followed_leagues : null;
        const res = await gamesApi.news(leagues);
        if (!cancel) setArticles(res?.articles || []);
      } catch {
        if (!cancel) setArticles([]);
      }
    })();
    return () => { cancel = true; };
  }, [me?.id]);

  const live    = (games?.live    || []).slice(0, 4);
  const recent  = (games?.recent  || []).slice(0, 4);

  return (
    <>
      <Eyebrow>Today’s board</Eyebrow>

      <section className="mb-10">
        <SectionHead title="Plays" italicWord={null} count={`${plays.length} · 24h`} />
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
          <Link
            to="/plays/new"
            aria-label="Add a play"
            style={{
              flex: '0 0 96px', aspectRatio: '3 / 4',
              border: `1.5px dashed ${c.inkFaint}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              gap: 6, color: c.inkDim, scrollSnapAlign: 'start',
            }}
          >
            <Plus size={22} strokeWidth={1.6} />
            <span style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: '0.18em' }}>ADD</span>
          </Link>
          {plays.slice(0, 12).map((p) => (
            <Link
              key={p.id}
              to={`/plays/${p.id}`}
              style={{
                flex: '0 0 96px', aspectRatio: '3 / 4', position: 'relative', overflow: 'hidden',
                border: `1px solid ${c.line}`, scrollSnapAlign: 'start',
                background: p.media_url ? '#000' : `hsl(${p.hue}, 60%, 55%)`,
              }}
            >
              {p.media_url ? (
                p.media_kind === 'video' ? (
                  <video src={p.media_url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={p.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                )
              ) : null}
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                padding: '8px 8px 6px', color: '#fff',
                fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em',
              }}>
                @{p.user?.username || 'anon'}
              </div>
            </Link>
          ))}
        </div>
      </section>

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

      {articles && articles.length > 0 && (
        <section className="mb-12">
          <SectionHead title="On the" italicWord="wire" count={`${articles.length}`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {articles.slice(0, 8).map((a) => <ArticleCard key={a.id || a.url} article={a} />)}
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

      <Link to={`/post/${post.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
        <div style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.35, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
          {post.content || post.text}
        </div>
      </Link>

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

function ArticleCard({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column',
        background: c.paper, border: `1px solid ${c.line}`,
        color: 'inherit', textDecoration: 'none',
        overflow: 'hidden',
        minHeight: 220,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.line)}
    >
      {article.image && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundImage: `url("${article.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            background: `${c.surface} url("${article.image}") center/cover no-repeat`,
          }}
        />
      )}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.accent, textTransform: 'uppercase' }}>
          {article.league} {article.published ? `· ${relTime(article.published)}` : ''}
        </div>
        <h3 style={{ fontFamily: fonts.display, fontSize: 19, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.02em', color: c.ink, margin: 0 }}>
          {article.title}
        </h3>
        {article.description && (
          <p style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 1.45, color: c.inkSoft, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.description}
          </p>
        )}
      </div>
    </a>
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
