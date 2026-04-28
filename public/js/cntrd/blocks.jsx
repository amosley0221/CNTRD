// blocks.jsx — Settings → Blocked accounts list. Pulls from
// /api/users/me/blocks and lets you unblock anyone.

function BlockedAccountsScreen({ tweaks, onNav }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try { setList(await API.blocks() || []); }
    catch (e) { setErr(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const unblock = async (u) => {
    try {
      await API.unblockUser(u.username);
      setList(prev => prev.filter(x => x.id !== u.id));
    } catch (e) { alert(e.message || 'Failed to unblock'); }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg-elev2)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('settings')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>BLOCKED</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.5, borderBottom: '0.5px solid var(--cn-border)' }}>
          Blocked accounts can't see your posts and don't appear in your feed, search, or messages. Unblock to reverse.
        </div>
        {loading ? <Empty>Loading…</Empty>
          : err ? <Empty danger>{err}</Empty>
          : list.length === 0 ? <Empty>No one blocked.</Empty>
          : list.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
              }}>
                <Avatar user={u} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{u.displayName}</div>
                  <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>@{u.username}</div>
                </div>
                <button onClick={() => unblock(u)} style={{
                  padding: '6px 12px', borderRadius: 999,
                  background: 'transparent', color: 'var(--cn-text)',
                  border: '0.5px solid var(--cn-border-s)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--cn-font-body)',
                }}>Unblock</button>
              </div>
            ))
        }
      </div>
    </div>
  );

  function Empty({ children, danger }) {
    return (
      <div style={{
        padding: 32, textAlign: 'center',
        color: danger ? 'var(--cn-danger)' : 'var(--cn-text-mute)',
        fontFamily: 'var(--cn-font-mono)', fontSize: 12,
      }}>{children}</div>
    );
  }
}

Object.assign(window, { BlockedAccountsScreen });
