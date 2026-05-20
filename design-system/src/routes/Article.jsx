import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Heart, Repeat2, Bookmark, MessageCircle } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Avatar } from '../components';
import { Reveal } from '../hooks/useReveal';
import { articles as articlesApi } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function Article() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { me } = useAuth();
  const seed = loc.state?.article || null;

  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  // Load: try GET first; if 404 and we have seed metadata from the Link
  // state, fall back to POST /resolve so a fresh URL still lands.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await articlesApi.get(id);
        if (!cancel) setArticle(data);
      } catch (e) {
        if (e.status === 404 && seed?.url) {
          try {
            const created = await articlesApi.resolve(seed);
            if (!cancel) setArticle(created);
            return;
          } catch (e2) { if (!cancel) setErr(e2.message); return; }
        }
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  // Comments load once the article id resolves.
  useEffect(() => {
    if (!article) return;
    let cancel = false;
    (async () => {
      try {
        const data = await articlesApi.comments(article.id);
        if (!cancel) setComments(data || []);
      } catch { if (!cancel) setComments([]); }
    })();
    return () => { cancel = true; };
  }, [article?.id]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const content = draft.trim();
    if (!content || sending || !me) return;
    setSending(true);
    try {
      const created = await articlesApi.comment(article.id, content);
      setComments((prev) => [...(prev || []), created]);
      setArticle((a) => a ? { ...a, comments: a.comments + 1 } : a);
      setDraft('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const toggle = async (kind) => {
    if (!me) { nav('/login', { state: { from: loc.pathname } }); return; }
    try {
      const res = await articlesApi.react(article.id, kind);
      setArticle((a) => a ? { ...a, reactions: res.reactions, my_reactions: res.my_reactions } : a);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (err && !article) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>{err}</div>;
  if (!article) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>;

  return (
    <>
      <button
        onClick={() => nav(-1)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.inkDim, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0 }}
      >
        <ChevronLeft size={18} /> <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em' }}>BACK</span>
      </button>

      <Reveal>
        <Eyebrow>{article.league || 'Article'} · {article.published_at ? relTime(article.published_at) : 'On the wire'}</Eyebrow>
      </Reveal>

      <Reveal>
        <h1 className="fraunces-soft" style={{
          fontFamily: fonts.display, fontWeight: 400,
          fontSize: 'clamp(34px, 6vw, 56px)', letterSpacing: '-0.03em',
          lineHeight: 1.05, margin: 0, marginBottom: 16, maxWidth: 860,
        }}>
          {article.title}
        </h1>
      </Reveal>

      {article.description && (
        <Reveal>
          <p style={{ fontFamily: fonts.display, fontStyle: 'italic', fontWeight: 300, fontSize: 19, lineHeight: 1.45, color: c.inkSoft, maxWidth: 640, marginBottom: 24 }}>
            {article.description}
          </p>
        </Reveal>
      )}

      {article.image && (
        <Reveal>
          <div style={{ marginBottom: 24, border: `1px solid ${c.line}`, overflow: 'hidden', maxWidth: 860 }}>
            <img src={article.image} alt="" style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'cover' }} />
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="flex items-center gap-3 mb-8 flex-wrap" style={{ paddingTop: 12, paddingBottom: 16, borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}` }}>
          <ReactionBtn icon={Heart}    label="LIKE"     active={article.my_reactions.like}     count={article.reactions.like}     onClick={() => toggle('like')} />
          <ReactionBtn icon={Repeat2}  label="REPOST"   active={article.my_reactions.repost}   count={article.reactions.repost}   onClick={() => toggle('repost')} />
          <ReactionBtn icon={Bookmark} label="SAVE"     active={article.my_reactions.bookmark} count={article.reactions.bookmark} onClick={() => toggle('bookmark')} />
          <ReactionBtn icon={MessageCircle} label="REPLY" count={article.comments} onClick={() => document.getElementById('cn-article-composer')?.focus()} />
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', border: `1px solid ${c.accent}`, color: c.accent,
              fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            VIEW ORIGINAL <ExternalLink size={13} />
          </a>
        </div>
      </Reveal>

      {/* COMMENT COMPOSER */}
      <Reveal>
        <form onSubmit={submit} className="flex items-start gap-3 mb-8" style={{ maxWidth: 640 }}>
          <Avatar initial={(me?.display_name?.[0] || me?.username?.[0] || '?').toUpperCase()} />
          <div className="flex-1">
            <textarea
              id="cn-article-composer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={me ? 'Add to the discussion' : 'Sign in to comment'}
              disabled={!me || sending}
              rows={2}
              maxLength={1000}
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'none',
                fontFamily: fonts.display, fontSize: 17, fontWeight: 300, color: c.ink, lineHeight: 1.4,
              }}
            />
            <div className="flex justify-between items-center mt-1">
              <span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
                {1000 - draft.length}
              </span>
              {me ? (
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  style={{
                    padding: '8px 16px', background: c.accent, color: c.paper, border: 'none',
                    cursor: sending ? 'wait' : 'pointer',
                    fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                    opacity: sending || !draft.trim() ? 0.5 : 1,
                  }}
                >
                  {sending ? 'Posting…' : 'Comment'}
                </button>
              ) : (
                <Link to="/login" state={{ from: loc.pathname }} style={{ color: c.accent, fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  SIGN IN →
                </Link>
              )}
            </div>
          </div>
        </form>
      </Reveal>

      {/* COMMENTS */}
      <div className="mb-12" style={{ maxWidth: 640 }}>
        {comments === null && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>
        )}
        {comments && comments.length === 0 && (
          <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft }}>
            No comments yet. Be the first.
          </div>
        )}
        {comments?.map((cmt) => <CommentRow key={cmt.id} cmt={cmt} />)}
      </div>
    </>
  );
}

function ReactionBtn({ icon: Icon, label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '10px 14px', border: `1px solid ${active ? c.accent : c.inkFaint}`,
        background: 'transparent', cursor: 'pointer',
        color: active ? c.accent : c.ink,
        fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
      }}
    >
      <Icon size={14} fill={active && (label === 'LIKE' || label === 'SAVE') ? c.accent : 'none'} />
      {label}
      <span style={{ color: active ? c.accent : c.inkDim, marginLeft: 4 }}>{count || 0}</span>
    </button>
  );
}

function CommentRow({ cmt }) {
  const initial = (cmt.user?.displayName?.[0] || cmt.user?.username?.[0] || '?').toUpperCase();
  return (
    <article className="flex items-start gap-3 py-4" style={{ borderBottom: `1px solid ${c.line}` }}>
      <Link to={`/u/${cmt.user.username}`}><Avatar initial={initial} /></Link>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="flex items-baseline gap-2">
          <Link to={`/u/${cmt.user.username}`} style={{ fontWeight: 600, fontSize: 13, color: c.ink, textDecoration: 'none' }}>
            {cmt.user.displayName || cmt.user.username}
          </Link>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>@{cmt.user.username}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, marginLeft: 'auto' }}>{relTime(cmt.created_at)}</span>
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 15, color: c.ink, lineHeight: 1.45, marginTop: 4, whiteSpace: 'pre-wrap' }}>
          {cmt.content}
        </div>
      </div>
    </article>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)   return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
