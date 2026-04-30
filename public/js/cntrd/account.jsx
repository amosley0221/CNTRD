// account.jsx — Settings → Account screen.
// Four self-contained forms in one screen: username, email, password,
// profile picture. Each form has its own busy / error / success state
// so a username-change error doesn't blow away other section state.

function AccountScreen({ tweaks, onNav, me, onMeUpdated, accountSection, setAccountSection }) {
  const u = me || ME;
  // Settings rows can deep-link straight to a specific editor by setting
  // accountSection before navigating. Consume it once and clear so a
  // back-then-forward sequence returns to the list.
  const [view, setView] = React.useState(accountSection || 'list');
  React.useEffect(() => {
    if (accountSection) {
      setView(accountSection);
      setAccountSection?.(null);
    }
  }, [accountSection, setAccountSection]);

  const headerLabel = {
    list: 'ACCOUNT',
    avatar: 'PROFILE PICTURE',
    username: 'USERNAME',
    email: 'EMAIL',
    password: 'CHANGE PASSWORD',
  }[view];

  const back = () => view === 'list' ? onNav?.('back') : setView('list');

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg-elev2)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '0.5px solid var(--cn-border)',
        background: 'var(--cn-bg)',
      }}>
        <button style={iconBtnStyle()} onClick={back}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>{headerLabel}</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '20px 18px calc(240px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        {view === 'list' && (
          <AccountList me={u} onPick={setView} />
        )}
        {view === 'avatar'   && <ProfilePictureCard me={u} onMeUpdated={onMeUpdated} />}
        {view === 'username' && <UsernameCard me={u} onMeUpdated={onMeUpdated} />}
        {view === 'email'    && <EmailCard    me={u} onMeUpdated={onMeUpdated} />}
        {view === 'password' && <PasswordCard onMeUpdated={onMeUpdated} />}
      </div>
    </div>
  );
}

function AccountList({ me, onPick }) {
  const rows = [
    { id: 'avatar',   label: 'Profile picture', value: me.avatar ? 'Custom photo' : 'Generated avatar' },
    { id: 'username', label: 'Username',        value: me.username || '' },
    { id: 'email',    label: 'Email',           value: me.email || '' },
    { id: 'password', label: 'Password',        value: '••••••••' },
  ];
  return (
    <section style={{
      borderRadius: 12,
      background: 'var(--cn-bg-elev)',
      border: '0.5px solid var(--cn-border)',
      overflow: 'hidden',
    }}>
      {rows.map((r, i) => (
        <button
          key={r.id}
          onClick={() => onPick(r.id)}
          style={{
            width: '100%', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'transparent',
            border: 'none',
            borderTop: i === 0 ? 'none' : '0.5px solid var(--cn-border)',
            cursor: 'pointer', color: 'var(--cn-text)',
            fontFamily: 'var(--cn-font-body)', textAlign: 'left',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--cn-font-mono)', fontSize: 10,
              color: 'var(--cn-text-mute)', letterSpacing: 1,
              textTransform: 'uppercase',
            }}>{r.label}</div>
            <div style={{
              marginTop: 2, fontSize: 14,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{r.value}</div>
          </div>
          <Icon name="chevron-r" size={16} stroke="var(--cn-text-mute)" />
        </button>
      ))}
    </section>
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
  const [cropFile, setCropFile] = React.useState(null);
  const inputRef = React.useRef(null);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null); setOk(null);
    setCropFile(file);
  };

  const upload = (blob) => {
    setCropFile(null);
    setBusy(true);
    API.uploadAvatar(blob)
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
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={upload}
        />
      )}
    </Card>
  );
}

// Circular crop modal. Drag to pan, slider to zoom. Outputs a 512×512 JPEG.
function AvatarCropper({ file, onCancel, onConfirm }) {
  const CROP_SIZE = 280;
  const OUTPUT_SIZE = 512;
  const [imgUrl, setImgUrl] = React.useState(null);
  const [imgSize, setImgSize] = React.useState(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [busy, setBusy] = React.useState(false);
  const drag = React.useRef(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Fit-cover scale so the smaller image dimension just fills the crop window.
  const baseScale = imgSize ? Math.max(CROP_SIZE / imgSize.w, CROP_SIZE / imgSize.h) : 1;
  const scale = baseScale * zoom;

  // Clamp offset so the displayed image always covers the crop window.
  const clampOffset = (next, scl = scale) => {
    if (!imgSize) return next;
    const maxX = Math.max(0, (imgSize.w * scl - CROP_SIZE) / 2);
    const maxY = Math.max(0, (imgSize.h * scl - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const onZoomChange = (z) => {
    const newScale = baseScale * z;
    setZoom(z);
    setOffset(prev => clampOffset(prev, newScale));
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    drag.current = { x: pt.clientX, y: pt.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    setOffset(clampOffset({
      x: drag.current.ox + (pt.clientX - drag.current.x),
      y: drag.current.oy + (pt.clientY - drag.current.y),
    }));
  };
  const onPointerUp = () => { drag.current = null; };

  const confirm = async () => {
    if (!imgSize || busy) return;
    setBusy(true);
    try {
      // Source rectangle on the natural image that maps to the crop window.
      const srcSize = CROP_SIZE / scale;
      const srcX = imgSize.w / 2 - srcSize / 2 - offset.x / scale;
      const srcY = imgSize.h / 2 - srcSize / 2 - offset.y / scale;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not encode image');
      const out = new File([blob], (file.name || 'avatar').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      onConfirm(out);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, touchAction: 'none',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--cn-bg-elev)',
        border: '0.5px solid var(--cn-border)',
        borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '0.5px solid var(--cn-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)',
            textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)',
            fontSize: 14,
          }}>CROP PHOTO</span>
          <button onClick={onCancel} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--cn-text-mute)', display: 'flex',
          }} title="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{
          padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          background: 'var(--cn-bg)',
        }}>
          <div
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            style={{
              width: CROP_SIZE, height: CROP_SIZE,
              borderRadius: '50%', overflow: 'hidden', position: 'relative',
              background: '#000', cursor: drag.current ? 'grabbing' : 'grab',
              userSelect: 'none', touchAction: 'none',
              boxShadow: '0 0 0 2px var(--cn-accent), 0 0 0 4px var(--cn-bg-elev)',
            }}
          >
            {imgUrl && imgSize && (
              <img
                src={imgUrl}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%', top: '50%',
                  width: imgSize.w * scale,
                  height: imgSize.h * scale,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  pointerEvents: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>1×</span>
            <input
              type="range" min={1} max={4} step={0.01}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--cn-accent)' }}
            />
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>4×</span>
          </div>
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 10,
            color: 'var(--cn-text-mute)', textAlign: 'center', lineHeight: 1.5,
          }}>
            Drag to reposition · pinch the slider to zoom
          </div>
        </div>

        <div style={{
          padding: '10px 14px', borderTop: '0.5px solid var(--cn-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onCancel} style={{
            padding: '8px 14px', borderRadius: 999,
            background: 'transparent', color: 'var(--cn-text-dim)',
            border: '0.5px solid var(--cn-border-s)', cursor: 'pointer',
            fontWeight: 600, fontSize: 12, fontFamily: 'var(--cn-font-body)',
          }}>Cancel</button>
          <button onClick={confirm} disabled={busy || !imgSize} style={{
            padding: '8px 16px', borderRadius: 999,
            background: busy || !imgSize ? 'var(--cn-bg-elev2)' : 'var(--cn-accent)',
            color:      busy || !imgSize ? 'var(--cn-text-mute)' : 'var(--cn-on-accent)',
            border: 'none',
            cursor: busy || !imgSize ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--cn-font-body)',
          }}>{busy ? 'Saving…' : 'Use photo'}</button>
        </div>
      </div>
    </div>
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
