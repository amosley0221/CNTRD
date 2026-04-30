// account.jsx — Settings → Account screen.
// Four self-contained forms in one screen: username, email, password,
// profile picture. Each form has its own busy / error / success state
// so a username-change error doesn't blow away other section state.

function AccountScreen({ tweaks, onNav, me, onMeUpdated }) {
  const u = me || ME;
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg-elev2)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg)',
      }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>ACCOUNT</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 18px calc(120px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <ProfilePictureCard me={u} onMeUpdated={onMeUpdated} />
        <UsernameCard me={u} onMeUpdated={onMeUpdated} />
        <EmailCard    me={u} onMeUpdated={onMeUpdated} />
        <PasswordCard onMeUpdated={onMeUpdated} />
      </div>
    </div>
  );
}

function Card({ title, children, footer }) {
  return (
    <section style={{
      borderRadius: 12,
      background: 'var(--cn-bg-elev)',
      border: '0.5px solid var(--cn-border)',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '10px 14px',
        fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', color: 'var(--cn-text-mute)',
        borderBottom: '0.5px solid var(--cn-border)',
      }}>{title}</header>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
      {footer}
    </section>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder, autoComplete }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{
          background: 'var(--cn-bg)', border: '0.5px solid var(--cn-border-s)',
          borderRadius: 10, padding: '10px 12px',
          color: 'var(--cn-text)', fontSize: 14,
          outline: 'none', fontFamily: 'var(--cn-font-body)',
        }}
      />
    </label>
  );
}

function StatusLine({ err, ok }) {
  if (!err && !ok) return null;
  return (
    <div style={{
      fontFamily: 'var(--cn-font-mono)', fontSize: 11,
      color: err ? 'var(--cn-danger)' : 'var(--cn-success)',
    }}>{err || ok}</div>
  );
}

function SaveButton({ onClick, busy, disabled, label = 'Save' }) {
  const off = busy || disabled;
  return (
    <button onClick={onClick} disabled={off} style={{
      alignSelf: 'flex-start',
      padding: '8px 16px', borderRadius: 999,
      background: off ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
      color:      off ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
      border: 'none', fontWeight: 700, fontSize: 13,
      cursor: off ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--cn-font-body)',
    }}>{busy ? 'Saving…' : label}</button>
  );
}

// ─── Profile picture ──────────────────────────────────────────────────
function ProfilePictureCard({ me, onMeUpdated }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [ok, setOk]     = React.useState(null);
  const inputRef = React.useRef(null);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr(null); setOk(null);
    API.uploadAvatar(file)
      .then(({ avatar }) => {
        onMeUpdated?.({ ...me, avatar });
        setOk('Avatar updated.');
      })
      .catch(e => setErr(e.message || 'Upload failed'))
      .finally(() => setBusy(false));
  };

  return (
    <Card title="Profile picture">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {me.avatar ? (
          <img src={me.avatar} alt="" style={{
            width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
            border: '0.5px solid var(--cn-border-s)',
          }} />
        ) : (
          <Avatar user={me} size={64} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{me.displayName || me.username}</div>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
            {me.avatar ? 'Custom photo' : 'Generated avatar'}
          </div>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={busy} style={{
          padding: '8px 14px', borderRadius: 999,
          background: busy ? 'var(--cn-bg-elev2)' : 'var(--cn-text)',
          color:      busy ? 'var(--cn-text-mute)' : 'var(--cn-bg)',
          border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
        }}>{busy ? 'Uploading…' : (me.avatar ? 'Replace' : 'Upload')}</button>
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
      </div>
      <StatusLine err={err} ok={ok} />
    </Card>
  );
}

// ─── Username ─────────────────────────────────────────────────────────
function UsernameCard({ me, onMeUpdated }) {
  const [val, setVal] = React.useState(me.username || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [ok, setOk]     = React.useState(null);

  const dirty = val.trim() !== me.username;
  const valid = val.length >= 3 && val.length <= 20 && /^[a-zA-Z0-9_]+$/.test(val);

  const save = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const updated = await API.updateAccount({ username: val.trim() });
      onMeUpdated?.(updated);
      setOk('Username updated.');
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Username">
      <FieldInput
        label="Username" value={val}
        onChange={(v) => { setVal(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setOk(null); setErr(null); }}
        autoComplete="username"
      />
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
        3–20 chars · letters, numbers, underscore. People @-mention you with this.
      </div>
      <StatusLine err={err} ok={ok} />
      <SaveButton onClick={save} busy={busy} disabled={!dirty || !valid} />
    </Card>
  );
}

// ─── Email ────────────────────────────────────────────────────────────
function EmailCard({ me, onMeUpdated }) {
  const [val, setVal] = React.useState(me.email || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [ok, setOk]     = React.useState(null);

  const dirty = val.trim() !== me.email;
  const valid = /.+@.+\..+/.test(val);

  const save = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const updated = await API.updateAccount({ email: val.trim() });
      onMeUpdated?.(updated);
      setOk('Email updated.');
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Email">
      <FieldInput
        label="Email" value={val} type="email"
        onChange={(v) => { setVal(v); setOk(null); setErr(null); }}
        placeholder="you@email.com" autoComplete="email"
      />
      <StatusLine err={err} ok={ok} />
      <SaveButton onClick={save} busy={busy} disabled={!dirty || !valid} />
    </Card>
  );
}

// ─── Password ─────────────────────────────────────────────────────────
function PasswordCard({ onMeUpdated }) {
  const [oldPw, setOldPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const [ok, setOk]     = React.useState(null);

  const checks = passwordChecks(newPw);
  const valid = !!oldPw && checks.length && checks.capital && checks.number && checks.special;

  const save = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const updated = await API.updateAccount({ current_password: oldPw, new_password: newPw });
      onMeUpdated?.(updated);
      setOldPw(''); setNewPw('');
      setOk('Password updated.');
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change password">
      <FieldInput
        label="Current password" type="password" autoComplete="current-password"
        value={oldPw} onChange={(v) => { setOldPw(v); setOk(null); setErr(null); }}
      />
      <FieldInput
        label="New password" type="password" autoComplete="new-password"
        value={newPw} onChange={(v) => { setNewPw(v); setOk(null); setErr(null); }}
      />
      {newPw.length > 0 && <PasswordChecklist password={newPw} />}
      <StatusLine err={err} ok={ok} />
      <SaveButton onClick={save} busy={busy} disabled={!valid} label="Update password" />
    </Card>
  );
}

Object.assign(window, { AccountScreen });
