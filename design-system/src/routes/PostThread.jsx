import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Repeat2, MessageCircle, ChevronLeft } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Avatar } from '../components';
import { posts as postsApi } from '../api';
import { useAuth } from '../auth/AuthContext';

const MAX = 280;

export default function PostThread() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const draftRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await postsApi.byId(id);
        if (!cancel) { setPost(data.post); setReplies(data.replies || []); }
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  const reply = async (e) => {
    e?.preventDefault?.();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await postsApi.reply(id, content);
      setDraft('');
      const data = await postsApi.byId(id);
      setPost(data.post);
      setReplies(data.replies || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  if (err) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert }}>{err}</div>;
  if (!post) return <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.2em' }}>LOADING…</div>;

  return (
    <>
      <button
        onClick={() => nav(-1)}
        aria-label="Back"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c.inkDim, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0 }}
      >
        <ChevronLeft size={18} /> <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em' }}>BACK</span>
      </button>

      <Eyebrow>Thread</Eyebrow>

      <PostBlock post={post} hero />

      <form onSubmit={reply} className="flex items-start gap-3 py-5" style={{ borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`, maxWidth: 640 }}>
        <Avatar initial={(me?.display_name?.[0] || me?.username?.[0] || '?').toUpperCase()} />
        <div className="flex-1">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add your take"
            rows={2}
            maxLength={MAX + 40}
            style={{
              width: '100%', border: 'none', outline: 'none',
              background: 'transparent', resize: 'none',
              fontFamily: fonts.display, fontSize: 17, fontWeight: 300, color: c.ink, lineHeight: 1.4,
            }}
          />
          <div className="flex justify-between items-center mt-1">
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: MAX - draft.length < 0 ? c.alert : c.inkDim, letterSpacing: '0.05em' }}>
              {MAX - draft.length}
            </span>
            <button
              type="submit"
              disabled={sending || !draft.trim() || MAX - draft.length < 0}
              style={{
                padding: '8px 16px', background: c.accent, color: c.paper, border: 'none',
                cursor: sending ? 'wait' : 'pointer',
                fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                opacity: sending || !draft.trim() ? 0.5 : 1,
              }}
            >
              {sending ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4" style={{ maxWidth: 640 }}>
        {replies.length === 0 && (
          <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>
            No replies yet. Be the first.
          </div>
        )}
        {replies.map((r) => <PostBlock key={r.id} post={r} />)}
      </div>
    </>
  );
}

function PostBlock({ post, hero = false }) {
  const u = post.user || {};
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.likes || 0);
  const initial = (u.displayName?.[0] || u.username?.[0] || '?').toUpperCase();
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
    <article className="py-5" style={{ borderBottom: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-3 mb-3">
        <Link to={`/u/${u.username}`}><Avatar initial={initial} /></Link>
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{u.displayName || u.username}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>@{u.username}</div>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
      </div>
      <div style={{ fontFamily: fonts.display, fontSize: hero ? 24 : 18, lineHeight: 1.4, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
        {post.content || post.text}
      </div>
      {post.image && (
        <img src={post.image} alt="" style={{ marginTop: 12, borderRadius: 4, maxHeight: 480, objectFit: 'cover', width: '100%', border: `1px solid ${c.line}` }} loading="lazy" />
      )}
      <div className="flex gap-6 mt-3" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
        <button onClick={toggle} className="flex items-center gap-1.5" style={{ color: liked ? c.accent : c.inkDim, background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Heart size={13} fill={liked ? c.accent : 'none'} />{likes}
        </button>
        <span className="flex items-center gap-1.5"><Repeat2 size={13} />{post.reposts || 0}</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={13} />{post.replies || 0}</span>
      </div>
    </article>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)  return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString();
}
