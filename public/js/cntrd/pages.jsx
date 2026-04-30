// pages.jsx — generic Terms / Privacy / About viewer.
// One screen handles all three (slug comes from props). Admins see an
// "Edit" button that flips the body to a textarea + save.

function PageScreen({ tweaks, onNav, me, pageSlug }) {
  const slug = pageSlug || 'about';
  const [page, setPage]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft]     = React.useState({ title: '', content: '' });
  const [saving, setSaving]   = React.useState(false);

  const isAdmin = !!me?.is_admin;

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = await API.page(slug);
      setPage(p);
      setDraft({ title: p.title || '', content: p.content || '' });
    } catch (e) {
      setErr(e.message || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => { load(); setEditing(false); }, [load]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const updated = await API.updatePage(slug, { title: draft.title, content: draft.content });
      setPage(updated);
      setEditing(false);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (page) setDraft({ title: page.title || '', content: page.content || '' });
    setEditing(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg-elev2)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{
          fontFamily: 'var(--cn-font-display)',
          fontWeight: 'var(--cn-display-weight)',
          textTransform: 'var(--cn-display-case)',
          letterSpacing: 'var(--cn-display-spacing)',
          fontSize: 14,
        }}>{(page?.title || slug).toUpperCase()}</span>
        {isAdmin ? (
          editing ? (
            <button onClick={save} disabled={saving} style={accentBtn(saving)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <button onClick={() => setEditing(true)} style={ghostBtn()}>Edit</button>
          )
        ) : (
          <span style={{ width: 32 }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 80px' }}>
          {loading ? (
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-text-mute)' }}>Loading…</div>
          ) : err ? (
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 12, color: 'var(--cn-danger)' }}>{err}</div>
          ) : editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="Title"
                style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--cn-bg-elev)',
                  border: '0.5px solid var(--cn-border-s)',
                  color: 'var(--cn-text)', fontSize: 16, fontWeight: 700,
                  outline: 'none', fontFamily: 'var(--cn-font-body)',
                }}
              />
              <textarea
                value={draft.content}
                onChange={e => setDraft({ ...draft, content: e.target.value })}
                placeholder="Body"
                rows={20}
                style={{
                  padding: '12px', borderRadius: 10,
                  background: 'var(--cn-bg-elev)',
                  border: '0.5px solid var(--cn-border-s)',
                  color: 'var(--cn-text)', fontSize: 14, lineHeight: 1.55,
                  outline: 'none', fontFamily: 'var(--cn-font-body)',
                  resize: 'vertical', minHeight: 320,
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={cancel} style={ghostBtn()}>Cancel</button>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
                  {draft.content.length.toLocaleString()} / 50,000
                </span>
              </div>
            </div>
          ) : page ? (
            <>
              <h1 style={{
                margin: 0,
                fontFamily: 'var(--cn-font-display)',
                fontWeight: 'var(--cn-display-weight)',
                textTransform: 'var(--cn-display-case)',
                letterSpacing: 'var(--cn-display-spacing)',
                fontSize: 34, lineHeight: 1.1,
              }}>{page.title}</h1>
              <div style={{
                marginTop: 6,
                fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)',
              }}>Last updated {page.updated_at}</div>
              <article style={{
                marginTop: 22,
                whiteSpace: 'pre-wrap',
                fontSize: 14, lineHeight: 1.65, color: 'var(--cn-text)',
              }}>{page.content}</article>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function accentBtn(disabled) {
  return {
    padding: '6px 14px', borderRadius: 999,
    background: disabled ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
    color: disabled ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
    border: 'none', fontWeight: 700, fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--cn-font-body)',
  };
}
function ghostBtn() {
  return {
    padding: '6px 12px', borderRadius: 999,
    background: 'transparent',
    color: 'var(--cn-text)',
    border: '0.5px solid var(--cn-border-s)',
    fontWeight: 600, fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--cn-font-body)',
  };
}

// Wrappers so the app router can map a single screen key per page.
function TermsScreen(props)   { return <PageScreen {...props} pageSlug="terms" />; }
function PrivacyScreen(props) { return <PageScreen {...props} pageSlug="privacy" />; }
function AboutScreen(props)   { return <PageScreen {...props} pageSlug="about" />; }

Object.assign(window, { PageScreen, TermsScreen, PrivacyScreen, AboutScreen });
