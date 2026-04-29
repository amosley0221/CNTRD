// post-thread.jsx — full thread view of a single post + its replies.
// Reachable by tapping any post body in the feed. The original post
// renders at the top, replies underneath, and a sticky reply composer
// at the bottom.

function PostThreadScreen({ tweaks, onNav, me, threadPostId, onPostDeleted }) {
  const [data, setData]       = React.useState(null);   // { post, replies }
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState(null);
  const [draft, setDraft]     = React.useState('');
  const [posting, setPosting] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!threadPostId) { setLoading(false); return; }
    setLoading(true); setErr(null);
    try {
      const res = await window.API.post(threadPostId);
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [threadPostId]);

  React.useEffect(() => { load(); }, [load]);

  // Listen for cross-screen events that mutate posts. When a post in
  // this thread is deleted (e.g. via the inline action menu) we drop
  // it from local state without a full refetch.
  React.useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.id;
      if (!id || !data) return;
      if (id === data.post?.id) {
        // The root post was deleted — close the thread.
        onNav?.('home');
        return;
      }
      setData(prev => prev ? {
        ...prev,
        replies: (prev.replies || []).filter(r => r.id !== id),
        post: prev.post && id === prev.post.id ? prev.post
            : prev.post && prev.post.replies > 0 ? { ...prev.post, replies: Math.max(0, prev.post.replies - 1) }
            : prev.post,
      } : prev);
    };
    window.addEventListener('cntrd:post-deleted', handler);
    return () => window.removeEventListener('cntrd:post-deleted', handler);
  }, [data, onNav]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || posting || !data?.post?.id) return;
    setPosting(true);
    try {
      const created = await window.API.createPost({
        content: text,
        type: 'take',
        reply_to: data.post.id,
      });
      setData(prev => prev ? {
        ...prev,
        replies: [...(prev.replies || []), window.normalizePost(created)],
        post: { ...prev.post, replies: (prev.post.replies ?? 0) + 1 },
      } : prev);
      setDraft('');
    } catch (e) {
      alert(e.message || 'Reply failed');
    } finally {
      setPosting(false);
    }
  };

  const handlePostUpdated = (updated) => {
    if (!updated?.id || !data) return;
    if (updated.id === data.post?.id) {
      setData(prev => ({ ...prev, post: window.normalizePost(updated) }));
    } else {
      setData(prev => ({
        ...prev,
        replies: (prev.replies || []).map(r => r.id === updated.id ? window.normalizePost(updated) : r),
      }));
    }
  };
  const handlePostDeleted = (id) => {
    if (!id || !data) return;
    if (id === data.post?.id) {
      onNav?.('home');
      return;
    }
    setData(prev => ({
      ...prev,
      replies: (prev.replies || []).filter(r => r.id !== id),
      post: { ...prev.post, replies: Math.max(0, (prev.post?.replies ?? 1) - 1) },
    }));
    onPostDeleted?.(id);
    window.dispatchEvent(new CustomEvent('cntrd:post-deleted', { detail: { id } }));
  };
  const handleUserBlocked = (userId) => {
    if (!userId || !data) return;
    setData(prev => ({
      ...prev,
      replies: (prev.replies || []).filter(r => r.user?.id !== userId),
    }));
  };

  const ctxValue = React.useMemo(() => ({
    currentUserId: me?.id || null,
    onPostUpdated: handlePostUpdated,
    onPostDeleted: handlePostDeleted,
    onUserBlocked: handleUserBlocked,
  }), [me?.id, data]);  // eslint-disable-line

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('home')} title="Back">
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{
          fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14,
        }}>POST</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>{err}</div>
        ) : !data?.post ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>Post not found.</div>
        ) : (
          <PostActionsContext.Provider value={ctxValue}>
            <Post post={data.post} />
            <div style={{
              padding: '10px 16px',
              borderBottom: '0.5px solid var(--cn-border)',
              background: 'var(--cn-bg-elev2)',
              fontFamily: 'var(--cn-font-mono)', fontSize: 10,
              color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase',
            }}>
              {(data.replies?.length || 0)} {data.replies?.length === 1 ? 'reply' : 'replies'}
            </div>
            {data.replies?.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 12 }}>
                No replies yet. Be the first.
              </div>
            ) : (
              data.replies.map(r => <Post key={r.id} post={r} />)
            )}
          </PostActionsContext.Provider>
        )}
      </div>

      {/* Sticky reply composer */}
      {data?.post && me && (
        <div style={{
          padding: '10px 12px',
          borderTop: '0.5px solid var(--cn-border)',
          background: 'var(--cn-bg-elev2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Avatar user={me} size={32} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 280))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={`Reply to @${data.post.user?.username || ''}`}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 999,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 14, outline: 'none',
              fontFamily: 'var(--cn-font-body)',
            }}
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || posting}
            style={{
              padding: '8px 16px', borderRadius: 999,
              background: draft.trim() && !posting ? 'var(--cn-accent)' : 'var(--cn-bg-elev)',
              color: draft.trim() && !posting ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
              border: 'none',
              cursor: draft.trim() && !posting ? 'pointer' : 'not-allowed',
              fontWeight: 800, fontSize: 13, fontFamily: 'var(--cn-font-body)',
            }}
          >{posting ? '…' : 'Reply'}</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PostThreadScreen });
