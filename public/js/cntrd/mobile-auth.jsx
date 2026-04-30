// mobile-auth.jsx — signup, login, settings, gameday chat for CNTRD

// ─── LOGIN ────────────────────────────────────────────────────
function LoginScreen({ tweaks, onNav, onLogin }) {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [persist, setPersist] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const submit = async () => {
    if (!email || !pw || busy) return;
    setBusy(true); setErr(null);
    try {
      // `persist` = checkbox state. When unchecked we'll keep the token
      // in sessionStorage so closing the tab logs the user out.
      if (onLogin) await onLogin({ login: email.trim(), password: pw, persist });
      onNav?.('home');
    } catch (e) {
      setErr(e.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column', padding: '60px 24px 40px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>CNTRD</div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--cn-text-dim)', fontStyle: 'italic' }}>Where the game gets loud.</div>

        <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Email or username" value={email} onChange={setEmail} placeholder="you@email.com" autoCapitalize="none" autoCorrect="off" />
          <PasswordField label="Password" value={pw} onChange={setPw} show={showPw} onToggleShow={() => setShowPw(s => !s)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--cn-accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--cn-text-dim)' }}>Stay signed in on this device</span>
          </label>
          {err && <div style={{ fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{
            marginTop: 8, padding: '14px', borderRadius: 12,
            background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
            border: 'none', fontWeight: 700, fontSize: 15, cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--cn-font-body)', opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <a style={{ alignSelf: 'center', marginTop: 4, color: 'var(--cn-text-dim)', fontSize: 12, fontFamily: 'var(--cn-font-mono)', cursor: 'pointer' }}>Forgot password?</a>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0' }}>
        <div style={{ flex: 1, height: '0.5px', background: 'var(--cn-border)' }} />
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>OR</span>
        <div style={{ flex: 1, height: '0.5px', background: 'var(--cn-border)' }} />
      </div>

      <button onClick={() => onNav?.('signup')} style={{
        padding: '14px', borderRadius: 12,
        background: 'transparent', color: 'var(--cn-text)',
        border: '0.5px solid var(--cn-border-s)',
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'var(--cn-font-body)',
      }}>Create an account</button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', autoCapitalize, autoCorrect }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize} autoCorrect={autoCorrect}
        style={{
          background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
          borderRadius: 10, padding: '12px 14px',
          color: 'var(--cn-text)', fontSize: 15,
          outline: 'none', fontFamily: 'var(--cn-font-body)',
        }}
      />
    </label>
  );
}

// Password field with an eye toggle to reveal the value as plain text.
function PasswordField({ label, value, onChange, placeholder = '••••••••', show, onToggleShow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      <div style={{
        position: 'relative',
        background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
        borderRadius: 10,
        display: 'flex', alignItems: 'center',
      }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoCapitalize="none" autoCorrect="off" autoComplete="current-password"
          style={{
            flex: 1,
            background: 'transparent', border: 'none',
            padding: '12px 44px 12px 14px',
            color: 'var(--cn-text)', fontSize: 15,
            outline: 'none', fontFamily: 'var(--cn-font-body)',
          }}
        />
        <button type="button" onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--cn-text-mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {show ? (
              <>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="3" y1="3" x2="21" y2="21" />
              </>
            ) : (
              <>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </label>
  );
}

// ─── PASSWORD RULES (shared) ──────────────────────────────────
function passwordChecks(p) {
  const s = p || '';
  return {
    length:  s.length >= 8,
    capital: /[A-Z]/.test(s),
    number:  /[0-9]/.test(s),
    special: /[^A-Za-z0-9]/.test(s),
  };
}
function passwordOK(p) {
  const c = passwordChecks(p);
  return c.length && c.capital && c.number && c.special;
}
function PasswordChecklist({ password }) {
  const c = passwordChecks(password);
  const items = [
    { key: 'length',  label: '8+ characters' },
    { key: 'capital', label: 'A capital letter' },
    { key: 'number',  label: 'A number' },
    { key: 'special', label: 'A special character' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px',
      marginTop: 4, fontFamily: 'var(--cn-font-mono)', fontSize: 11,
    }}>
      {items.map(it => (
        <div key={it.key} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: c[it.key] ? 'var(--cn-success)' : 'var(--cn-text-mute)',
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `1px solid ${c[it.key] ? 'var(--cn-success)' : 'var(--cn-border-s)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
          }}>{c[it.key] ? '✓' : ''}</span>
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ─── SIGNUP / ONBOARDING ──────────────────────────────────────
function SignupScreen({ tweaks, onNav, onSignup }) {
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showSignupPw, setShowSignupPw] = React.useState(false);
  const [picks, setPicks] = React.useState([]);
  const [leaguePicks, setLeaguePicks] = React.useState([]);
  const [avatarHue, setAvatarHue] = React.useState(280);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);

  const togglePick = (code) => {
    setPicks(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  };
  const toggleLeague = (code) => {
    setLeaguePicks(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  };

  // When the user reaches the leagues step, pre-select the leagues their
  // picked teams belong to (a 76ers fan auto-follows NBA). They can edit.
  const seededLeaguesRef = React.useRef(false);
  React.useEffect(() => {
    if (step === 4 && !seededLeaguesRef.current) {
      const inferred = Array.from(new Set(
        picks.map(k => k.includes(':') ? k.split(':')[0] : null).filter(Boolean)
      ));
      setLeaguePicks(prev => {
        const merged = new Set([...prev, ...inferred]);
        return Array.from(merged);
      });
      seededLeaguesRef.current = true;
    }
  }, [step, picks]);

  const finish = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      if (onSignup) {
        await onSignup({
          email: email.trim(),
          username: username.trim(),
          password,
          teams: picks,
          leagues: leaguePicks,
          avatar_hue: avatarHue,
        });
      }
      onNav?.('home');
    } catch (e) {
      setErr(e.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  // Email + username are required; everything else (avatar, teams, leagues)
  // is optional — users can skip and configure later from Settings.
  const stepValid =
    step === 0 ? (email.includes('@') && passwordOK(password)) :
    step === 1 ? (username.length >= 3) :
    /* steps 2/3/4 */ true;

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={() => step > 0 ? setStep(step - 1) : onNav?.('login')} style={iconBtnStyle()}>
          <Icon name="chevron-l" size={20} stroke="var(--cn-text)" />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width: 22, height: 3, borderRadius: 2, background: i <= step ? 'var(--cn-accent)' : 'var(--cn-border)' }} />
          ))}
        </div>
        <span style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        {step === 0 && (
          <>
            <H1>Create your account</H1>
            <Subhead>You'll need an email and a password. We'll never share either.</Subhead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" autoCapitalize="none" autoCorrect="off" />
              <PasswordField label="Password" value={password} onChange={setPassword} placeholder="8+ chars, 1 capital, 1 number, 1 symbol" show={showSignupPw} onToggleShow={() => setShowSignupPw(s => !s)} />
              <PasswordChecklist password={password} />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <H1>Pick a username</H1>
            <Subhead>This is how you'll be known across CNTRD. You can change it later.</Subhead>
            <div style={{ marginTop: 24 }}>
              <Field label="Username" value={username} onChange={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="e.g. courtside_kid" />
              <div style={{ marginTop: 8, fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: username.length >= 3 ? 'var(--cn-success)' : 'var(--cn-text-mute)' }}>
                {username.length >= 3 ? `✓ @${username} is available` : '3+ characters · letters, numbers, underscore'}
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <H1>Add a profile pic</H1>
            <Subhead>Or pick a generated one. You can always update it from Settings.</Subhead>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
              <div style={{
                width: 140, height: 140, borderRadius: '50%',
                background: avatarBg(avatarHue),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 56,
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              }}>{(username[0] || 'U').toUpperCase()}</div>
              <button style={{
                marginTop: 18, padding: '10px 18px', borderRadius: 999,
                background: 'var(--cn-bg-elev)', color: 'var(--cn-text)',
                border: '0.5px solid var(--cn-border-s)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--cn-font-body)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="image" size={15} sw={1.7} />
                Upload from camera roll
              </button>
              <div style={{ marginTop: 24, width: '100%' }}>
                <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Or shuffle the colors</div>
                <input type="range" min="0" max="360" value={avatarHue} onChange={e => setAvatarHue(+e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <H1>Pick your teams</H1>
            <Subhead>Tap a league to expand. Pick as many as you want, or skip and add them later from Settings.</Subhead>
            <div style={{ marginTop: 18 }}>
              <LeaguePicker picks={picks} onTogglePick={togglePick} />
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <H1>Follow leagues</H1>
            <Subhead>These decide what you see in Next Up + Recent Finals. Your favorite teams' leagues are pre-selected. Add UFC, golf, tennis, racing, or anything else you watch — or skip for now.</Subhead>
            <div style={{ marginTop: 18 }}>
              <LeaguesPicker picks={leaguePicks} onTogglePick={toggleLeague} />
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '12px 24px 28px', borderTop: '0.5px solid var(--cn-border)' }}>
        {err && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--cn-danger)', fontFamily: 'var(--cn-font-mono)' }}>{err}</div>}
        <button onClick={() => step < 4 ? (stepValid && setStep(step + 1)) : finish()} disabled={!stepValid || busy} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: (stepValid && !busy) ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
          color: (stepValid && !busy) ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
          border: 'none', fontWeight: 700, fontSize: 15,
          cursor: (stepValid && !busy) ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--cn-font-body)',
        }}>{busy
          ? 'Creating account…'
          : (step < 4
              ? (step === 3 && picks.length === 0
                  ? 'Skip for now'
                  : (step === 4 && leaguePicks.length === 0 ? 'Skip for now' : 'Continue'))
              : (picks.length === 0 && leaguePicks.length === 0
                  ? 'Finish · skip for now'
                  : `Finish · ${picks.length} team${picks.length === 1 ? '' : 's'} · ${leaguePicks.length} league${leaguePicks.length === 1 ? '' : 's'}`))}</button>
      </div>
    </div>
  );
}

function H1({ children }) {
  return <h1 style={{ margin: 0, fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 30, lineHeight: 1.05 }}>{children}</h1>;
}
function Subhead({ children }) {
  return <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--cn-text-dim)', lineHeight: 1.45, textWrap: 'pretty' }}>{children}</p>;
}

// ─── SETTINGS ─────────────────────────────────────────────────
function SettingsScreen({ tweaks, setTweak, onNav, me, onMeUpdated, unreadNotifs, setAccountSection }) {
  const goAccount = (section) => {
    setAccountSection?.(section);
    onNav?.('account');
  };
  const meUser = me || ME;
  const togglePrivate = async (next) => {
    try {
      const updated = await API.updateMe({ is_private: !!next });
      onMeUpdated?.(updated);
    } catch (e) {
      alert(e.message || 'Failed to update');
    }
  };
  const Section = ({ title, children }) => (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', padding: '0 16px 6px' }}>{title}</div>
      <div style={{ background: 'var(--cn-bg-elev)', borderTop: '0.5px solid var(--cn-border)', borderBottom: '0.5px solid var(--cn-border)' }}>{children}</div>
    </div>
  );
  const Row = ({ label, sub, right, last, onClick }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: last ? 'none' : '0.5px solid var(--cn-border)', minHeight: 52, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--cn-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
  const ToggleSwitch = ({ on, onChange }) => (
    <button onClick={() => onChange(!on)} style={{
      position: 'relative', width: 44, height: 26, border: 'none',
      borderRadius: 999, background: on ? 'var(--cn-accent)' : 'var(--cn-border-s)',
      cursor: 'pointer', padding: 0,
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
    </button>
  );
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg-elev2)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg)' }}>
        <button style={iconBtnStyle()} onClick={() => onNav?.('back')}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 16 }}>SETTINGS</span>
        <span style={{ width: 32 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
        <Section title="Activity">
          <Row
            label="Notifications"
            sub={unreadNotifs > 0 ? `${unreadNotifs} unread` : 'Live games, follows, messages'}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {unreadNotifs > 0 && <span style={{ padding: '0 6px', minWidth: 18, height: 18, borderRadius: 999, background: 'var(--cn-accent)', color: 'var(--cn-on-accent)', fontFamily: 'var(--cn-font-mono)', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</span>}
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => onNav?.('notifications')}
          />
          <Row
            label="Direct messages"
            sub="Chats with people you follow + groups"
            right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />}
            onClick={() => onNav?.('messages')}
          />
          <Row
            label="Notification preferences"
            sub="Pick which game alerts and social pings you want"
            right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />}
            onClick={() => onNav?.('notificationPrefs')}
            last
          />
        </Section>

        <Section title="Privacy">
          <Row
            label="Private profile"
            sub={meUser.is_private ? 'New followers must be approved by you' : 'Anyone can follow you and see your posts'}
            right={<ToggleSwitch on={!!meUser.is_private} onChange={togglePrivate} />}
          />
          <Row
            label="Blocked accounts"
            sub="Manage who you've blocked"
            right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />}
            onClick={() => onNav?.('blocks')}
            last
          />
        </Section>

        <Section title="Appearance">
          <Row label="Dark mode" sub={tweaks.dark ? 'Following the night game' : 'Day game energy'} right={<ToggleSwitch on={tweaks.dark} onChange={v => setTweak('dark', v)} />} />
          <Row label="Accent color" right={
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 22px)',
              gap: 6,
              justifyContent: 'end',
            }}>
              {[
                '#D4FF3A',  // lime (default)
                '#FF3B30',  // red
                '#3B82F6',  // blue
                '#FB923C',  // orange
                '#A855F7',  // purple
                '#EC4899',  // pink
                '#22C55E',  // green
                '#FACC15',  // yellow
              ].map(c => (
                <button key={c} onClick={() => setTweak('accent', c)} style={{
                  width: 22, height: 22, borderRadius: '50%', background: c, border: tweaks.accent === c ? '2px solid var(--cn-text)' : '0.5px solid var(--cn-border-s)', cursor: 'pointer',
                }} />
              ))}
            </div>
          } />
          <Row label="Feed density" right={
            <div style={{ display: 'flex', gap: 4, padding: 2, borderRadius: 8, background: 'var(--cn-bg-elev2)' }}>
              {['cozy','compact'].map(d => (
                <button key={d} onClick={() => setTweak('density', d)} style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  background: tweaks.density === d ? 'var(--cn-bg)' : 'transparent',
                  color: tweaks.density === d ? 'var(--cn-text)' : 'var(--cn-text-mute)',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'var(--cn-font-body)',
                }}>{d}</button>
              ))}
            </div>
          } last />
        </Section>

        <Section title="Account">
          <Row
            label="Username"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>@{meUser.username}</span>
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => goAccount('username')}
          />
          <Row
            label="Email"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meUser.email || '—'}</span>
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => goAccount('email')}
          />
          <Row
            label="Change password"
            right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />}
            onClick={() => goAccount('password')}
          />
          <Row
            label="Profile picture"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {meUser.avatar
                  ? <img src={meUser.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '0.5px solid var(--cn-border-s)' }} />
                  : <Avatar user={meUser} size={28} />}
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => goAccount('avatar')}
            last
          />
        </Section>

        <Section title="Following">
          <Row
            label="My teams"
            sub={(meUser.teams && meUser.teams.length) ? `${meUser.teams.length} selected` : 'Pick the teams you root for'}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(meUser.teams || []).slice(0, 4).length > 0 && <TeamTagsRow codes={(meUser.teams || []).slice(0, 4)} size="xs" />}
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => onNav?.('teams')}
          />
          <Row
            label="My leagues"
            sub={(meUser.leagues && meUser.leagues.length) ? `${meUser.leagues.length} followed` : 'Pick the sports + leagues you watch'}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(meUser.leagues || []).slice(0, 4).length > 0 && (
                  <span style={{ display: 'inline-flex', gap: 4, fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)' }}>
                    {(meUser.leagues || []).slice(0, 4).join(' · ')}
                  </span>
                )}
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => onNav?.('leagues')}
            last
          />
        </Section>

        {meUser.is_admin && (
          <Section title="Admin">
            <Row
              label={<span style={{ color: 'var(--cn-accent)' }}>Open admin console</span>}
              sub="Manage users + moderate posts"
              right={<Icon name="chevron-r" size={14} stroke="var(--cn-accent)" />}
              onClick={() => onNav?.('admin')}
              last
            />
          </Section>
        )}

        <Section title="More">
          <Row label="Terms of service" right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} onClick={() => onNav?.('terms')} />
          <Row label="Privacy policy"   right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} onClick={() => onNav?.('privacy')} />
          <Row label="About CNTRD" sub="v2.4 · build 1284" right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} onClick={() => onNav?.('about')} />
          <Row label={<span style={{ color: 'var(--cn-danger)' }}>Sign out</span>} right={<Icon name="logout" size={16} stroke="var(--cn-danger)" />} onClick={() => onNav?.('logout')} last />
        </Section>
      </div>
    </div>
  );
}

// ─── GAMEDAY CHAT ─────────────────────────────────────────────
// List view shown when the user opens Gameday without picking a specific
// game. Tap a row → opens that game's chat. Favorite-team games (matched
// league-aware) float to a "YOUR TEAMS" group at the top.
function GamedayList({ tweaks, onNav, games, me, onPick, unreadMessages = 0 }) {
  const allLive     = games?.live     || [];
  const allUpcoming = games?.upcoming || [];
  const allRecent   = games?.recent   || [];

  const favSet = React.useMemo(() => new Set(me?.teams || []), [me]);
  const matches = (g) => {
    if (!favSet.size) return false;
    if (favSet.has(`${g.league}:${g.home}`) || favSet.has(`${g.league}:${g.away}`)) return true;
    // Legacy bare-code support: only fires when the saved pick has no colon.
    for (const f of favSet) {
      if (!String(f).includes(':') && (f === g.home || f === g.away)) return true;
    }
    return false;
  };

  // Show only games from leagues the user follows, plus games involving a
  // team they marked as a favorite. Everything else is filtered out — the
  // Gameday list mirrors the user's notification settings, so an MLB-only
  // fan never sees WNBA cards.
  const followedLeagues = React.useMemo(() => new Set(me?.leagues || []), [me]);
  const isRelevant = React.useCallback((g) => {
    if (!g) return false;
    return followedLeagues.has(g.league) || matches(g);
  }, [followedLeagues, favSet]);   // eslint-disable-line

  const relevantLive     = allLive.filter(isRelevant);
  const relevantUpcoming = allUpcoming.filter(isRelevant);
  // Recent finals: only games that ended within the chat's 24 h grace
  // window are joinable. We approximate "ended" as game_start + 3 h, so
  // the chat is still open while game_start + 27 h > now → game_start
  // must be > now - 27 h. Practically: keep games started in the last
  // 27 hours (anything older is past close anyway).
  const recentCutoffMs = Date.now() - 27 * 3600 * 1000;
  const relevantRecent = allRecent.filter(g => {
    if (!isRelevant(g)) return false;
    const startMs = Date.parse(g.date || '');
    return Number.isFinite(startMs) && startMs > recentCutoffMs;
  });

  // League filter — shows every league the user follows or has a team
  // in, even when there's nothing scheduled today, so the user can
  // confirm at a glance which leagues are wired up. The pill row +
  // empty state read together give a clear "no NBA games today" rather
  // than silently hiding the league.
  const [leagueFilter, setLeagueFilter] = React.useState('all');
  const teamLeagues = React.useMemo(() => {
    const out = new Set();
    for (const f of favSet) {
      const s = String(f);
      if (s.includes(':')) out.add(s.split(':')[0]);
    }
    return out;
  }, [favSet]);
  const availableLeagues = React.useMemo(() => {
    // Union of followed leagues + leagues containing a favorite team +
    // any league with a game today (covers cases where the user
    // forgot to check the league but still wants to see its games).
    const seen = new Set();
    for (const l of followedLeagues) seen.add(l);
    for (const l of teamLeagues) seen.add(l);
    for (const g of [...relevantLive, ...relevantUpcoming, ...relevantRecent]) if (g?.league) seen.add(g.league);
    return Array.from(seen).sort();
  }, [followedLeagues, teamLeagues, relevantLive, relevantUpcoming, relevantRecent]);
  // Drop a stale filter if the league disappears from the selectable set.
  React.useEffect(() => {
    if (leagueFilter !== 'all' && !availableLeagues.includes(leagueFilter)) {
      setLeagueFilter('all');
    }
  }, [leagueFilter, availableLeagues]);

  const inLeague = (g) => leagueFilter === 'all' || g.league === leagueFilter;
  const live     = relevantLive.filter(inLeague);
  const upcoming = relevantUpcoming.filter(inLeague);
  const recent   = relevantRecent.filter(inLeague);

  // Partition each group; "your teams" combines live+upcoming favorites,
  // live ones rendered first.
  const yourLive     = live.filter(matches);
  const yourUpcoming = upcoming.filter(matches);
  const yours        = [...yourLive, ...yourUpcoming];
  const otherLive    = live.filter(g => !matches(g));
  const otherUpcoming = upcoming.filter(g => !matches(g));
  const yourRecent   = recent.filter(matches);
  const otherRecent  = recent.filter(g => !matches(g));

  const empty = !live.length && !upcoming.length && !recent.length;
  // Distinguish "no games at all" from "you follow nothing yet" so the
  // empty state can prompt setup instead of "no games right now".
  const followsNothing = !followedLeagues.size && !favSet.size;
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <button onClick={() => onNav?.('back')} style={iconBtnStyle()}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>GAMEDAY</span>
        <span style={{ width: 32 }} />
      </div>
      {availableLeagues.length > 1 && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 14px',
          overflowX: 'auto',
          borderBottom: '0.5px solid var(--cn-border)',
          background: 'var(--cn-bg-elev2)',
        }}>
          {[{ id: 'all', label: 'All' }, ...availableLeagues.map(l => ({ id: l, label: l }))].map(o => {
            const active = leagueFilter === o.id;
            return (
              <button key={o.id} onClick={() => setLeagueFilter(o.id)} style={{
                padding: '5px 12px', borderRadius: 999,
                background: active ? 'var(--cn-accent)' : 'transparent',
                color: active ? 'var(--cn-on-accent)' : 'var(--cn-text-dim)',
                border: `0.5px solid ${active ? 'transparent' : 'var(--cn-border-s)'}`,
                fontFamily: 'var(--cn-font-body)',
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{o.label}</button>
            );
          })}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>
        {empty ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 22 }}>
              {followsNothing
                ? 'Set up your sports'
                : leagueFilter !== 'all'
                  ? `No ${leagueFilter} games today`
                  : 'No games right now'}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
              {followsNothing
                ? 'Add leagues you follow and teams you favorite — Gameday only shows games that match.'
                : leagueFilter !== 'all'
                  ? 'Tap "All" to see games from your other followed leagues.'
                  : "When a game tips off or one's scheduled today, you'll see it here."}
            </div>
            {followsNothing && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => onNav?.('leagues')} style={{
                  padding: '8px 14px', borderRadius: 999,
                  background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 12,
                }}>Pick leagues</button>
                <button onClick={() => onNav?.('teams')} style={{
                  padding: '8px 14px', borderRadius: 999,
                  background: 'transparent', color: 'var(--cn-text-dim)',
                  border: '0.5px solid var(--cn-border-s)', cursor: 'pointer',
                  fontFamily: 'var(--cn-font-body)', fontWeight: 700, fontSize: 12,
                }}>Pick teams</button>
              </div>
            )}
          </div>
        ) : (
          <>
            {yours.length > 0 && (
              <GamedayGroup
                label="YOUR TEAMS"
                accent
                items={yours}
                liveFlags={yours.map(g => yourLive.includes(g))}
                onPick={onPick}
              />
            )}
            {otherLive.length > 0     && <GamedayGroup label={yours.length ? 'OTHER LIVE NOW' : 'LIVE NOW'} live items={otherLive} onPick={onPick} />}
            {otherUpcoming.length > 0 && <GamedayGroup label={yours.length ? 'OTHER UP NEXT' : 'UP NEXT'} items={otherUpcoming} onPick={onPick} />}
            {yourRecent.length > 0    && <GamedayGroup label="YOUR RECENT FINALS" accent items={yourRecent} onPick={onPick} />}
            {otherRecent.length > 0   && <GamedayGroup label={yourRecent.length ? 'OTHER RECENT FINALS' : 'RECENT FINALS'} items={otherRecent} onPick={onPick} />}
          </>
        )}
      </div>
      <BottomNav active="chat" onChange={onNav} unreadMessages={unreadMessages} />
    </div>
  );
}

function GamedayGroup({ label, live, accent, items, liveFlags, onPick }) {
  const dotColor = accent ? 'var(--cn-accent)' : (live ? 'var(--cn-live)' : null);
  const labelColor = accent ? 'var(--cn-accent)' : (live ? 'var(--cn-live)' : 'var(--cn-text-mute)');
  return (
    <div>
      <div style={{
        padding: '12px 16px 6px',
        fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 1,
        color: labelColor,
        fontWeight: 800,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {dotColor && <span style={{
          width: 6, height: 6, borderRadius: '50%', background: dotColor,
          animation: live ? 'cn-pulse 1.5s ease-in-out infinite' : 'none',
        }} />}
        {label}
      </div>
      <div>
        {items.map((g, i) => (
          <GamedayRow
            key={g.id}
            game={g}
            live={liveFlags ? !!liveFlags[i] : !!live}
            favorite={accent}
            onClick={() => onPick?.(g)}
          />
        ))}
      </div>
    </div>
  );
}

function GamedayRow({ game, live, favorite, onClick }) {
  const home = game.homeTeam || TEAMS[game.home] || { code: game.home, name: game.home, primary: '#666', accent: '#999' };
  const away = game.awayTeam || TEAMS[game.away] || { code: game.away, name: game.away, primary: '#666', accent: '#999' };
  const seriesText = game.series && (game.series.summary || game.series.bestOf)
    ? `${game.series.summary || ''}${game.series.bestOf ? ` · best of ${game.series.bestOf}` : ''}`.trim()
    : '';
  const aggText = game.aggregate
    ? `agg ${game.aggregate.away}–${game.aggregate.home}`
    : '';
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--cn-border)',
      cursor: 'pointer',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)' }}>
          <TeamMini team={away} record={game.awayRecord} league={game.league} />
          <span style={{ color: 'var(--cn-text-mute)', fontSize: 11, fontFamily: 'var(--cn-font-mono)' }}>@</span>
          <TeamMini team={home} record={game.homeRecord} league={game.league} />
          {favorite && <span title="Your team" style={{ color: 'var(--cn-accent)', fontSize: 12, fontWeight: 800 }}>★</span>}
        </div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', marginTop: 4 }}>
          {game.league} · {game.period || (live ? 'LIVE' : 'Scheduled')}
          {seriesText && <span style={{ color: 'var(--cn-accent)' }}> · {seriesText}</span>}
          {aggText && <span> · {aggText}</span>}
        </div>
      </div>
      {live || game.state === 'final' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: 22 }}>{game.awayScore}</span>
          <span style={{ color: 'var(--cn-text-mute)', fontSize: 14 }}>·</span>
          <span style={{ fontSize: 22 }}>{game.homeScore}</span>
        </div>
      ) : (
        <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>
          {game.period || ''}
        </span>
      )}
      <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
    </div>
  );
}

function TeamMini({ team, record, league }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <TeamLogo team={team} size={22} radius={5} />
      <TeamName team={team} league={league} fontSize={14} weight={600} color="var(--cn-text)" />
      {record && (
        <span style={{
          fontFamily: 'var(--cn-font-mono)', fontSize: 10,
          color: 'var(--cn-text-mute)', marginLeft: 2,
        }}>({record})</span>
      )}
    </span>
  );
}

// Quick-react picker shown above the input when the + button is tapped.
// Tapping a face appends it to the draft so users can build up a longer
// reaction or pair an emoji with text.
const CHAT_QUICK_REACTS = ['🔥', '🙌', '👏', '💯', '😱', '🤯', '🤝', '😤', '🏀', '⚽', '🏈', '⚾', '🏒', '🥶'];

function mapGameMsg(m, me, homeCode, awayCode) {
  const userTeams = (m.user?.teams || []).map(t => String(t).split(':').pop());
  const deleted = !!m.deleted;
  return {
    id: m.id,
    userId: m.user?.id || null,
    user: m.user?.username || 'unknown',
    text: deleted ? 'Message deleted' : m.content,
    deleted,
    edited: !!m.edited_at,
    time: relTime(m.created_at),
    mine: !!me && !!m.user && m.user.id === me.id,
    side: userTeams.find(c => c === homeCode || c === awayCode) || null,
    reply_to: m.reply_to ? {
      id: m.reply_to.id,
      content: m.reply_to.deleted ? 'Message deleted' : m.reply_to.content,
      deleted: !!m.reply_to.deleted,
      username: m.reply_to.user?.username || '',
      displayName: m.reply_to.user?.displayName || '',
    } : null,
    meSnapshot: m.user ? {
      username: m.user.username,
      displayName: m.user.displayName,
      avatar: m.user.avatar,
      avatarHue: m.user.avatarHue,
    } : null,
  };
}

function GamedayScreen({ tweaks, onNav, games, gamedayPick, setGamedayPick, me, unreadMessages = 0 }) {
  const [side, setSide] = React.useState('all');
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [showReacts, setShowReacts] = React.useState(false);
  const [convId, setConvId] = React.useState(null);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState(null);
  const [replyTo, setReplyTo] = React.useState(null);
  const [mentionPicker, setMentionPicker] = React.useState(null);
  const [closedAt, setClosedAt] = React.useState(null);
  const [closedFully, setClosedFully] = React.useState(false);
  const inputRef = React.useRef(null);
  const lastMsgAt = React.useRef(null);
  const pollRef = React.useRef(null);
  const homeCodeRef = React.useRef(null);
  const awayCodeRef = React.useRef(null);

  const gameId = gamedayPick?.id;

  // Load shared chat room when game changes; poll for new messages.
  React.useEffect(() => {
    setMessages([]);
    setDraft('');
    setShowReacts(false);
    setSide('all');
    setConvId(null);
    setClosedAt(null);
    setClosedFully(false);
    lastMsgAt.current = null;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    if (!gameId) return;

    const game = gamedayPick;
    const home = game.homeTeam || TEAMS[game.home] || { code: game.home };
    const away = game.awayTeam || TEAMS[game.away] || { code: game.away };
    homeCodeRef.current = home.code;
    awayCodeRef.current = away.code;

    let active = true;
    setChatLoading(true);
    window.API.gamedayConversation(gameId, { state: game.state, date: game.date })
      .then(({ convId: cid, messages: msgs, now, closes_at, closed }) => {
        if (!active) return;
        setConvId(cid);
        setClosedAt(closes_at || null);
        setClosedFully(!!closed);
        const mapped = msgs.map(m => mapGameMsg(m, me, home.code, away.code));
        setMessages(mapped);
        lastMsgAt.current = msgs.length > 0
          ? msgs[msgs.length - 1].created_at
          : (now || new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''));

        // No live polling once the chat is closed — content is static.
        if (closed) return;

        pollRef.current = setInterval(async () => {
          if (!active) return;
          try {
            const cursor = lastMsgAt.current;
            if (!cursor) return;
            const fresh = await window.API.conversationMessagesAfter(cid, cursor);
            if (!active || !fresh.length) return;
            lastMsgAt.current = fresh[fresh.length - 1].created_at;
            setMessages(prev => {
              const seen = new Set(prev.map(m => m.id));
              const added = fresh
                .filter(m => !seen.has(m.id))
                .map(m => mapGameMsg(m, me, homeCodeRef.current, awayCodeRef.current));
              return added.length ? [...prev, ...added] : prev;
            });
          } catch {}
        }, 2500);
      })
      .catch((e) => {
        if (e?.status === 410) {
          // Chat closed and caller was never a member.
          setClosedFully(true);
          setClosedAt(e.data?.closes_at || null);
        }
      })
      .finally(() => { if (active) setChatLoading(false); });

    return () => {
      active = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [gameId]);

  // List mode: no specific game picked → show live + upcoming as rows.
  if (!gamedayPick) {
    return <GamedayList tweaks={tweaks} onNav={onNav} games={games} me={me} onPick={setGamedayPick} unreadMessages={unreadMessages} />;
  }
  const game = gamedayPick;
  const home = game.homeTeam || TEAMS[game.home] || { code: game.home, name: game.home, primary: '#666', accent: '#999' };
  const away = game.awayTeam || TEAMS[game.away] || { code: game.away, name: game.away, primary: '#666', accent: '#999' };
  const isLive = game.state === 'live';
  const filtered = side === 'all' ? messages : messages.filter(m => m.side === side || !m.side);
  const goBack = () => setGamedayPick?.(null);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !convId || closedFully) return;
    const meUser = me || (typeof window !== 'undefined' && window.ME);
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: optimisticId,
      userId: meUser?.id || null,
      user: meUser?.username || 'me',
      side: (meUser?.teams || []).map(t => String(t).split(':').pop()).find(c => c === home.code || c === away.code) || null,
      text,
      time: 'now',
      mine: true,
      reply_to: replyTo ? {
        id: replyTo.id, content: replyTo.text,
        username: replyTo.user, displayName: replyTo.meSnapshot?.displayName || replyTo.user,
      } : null,
      meSnapshot: meUser ? {
        username: meUser.username,
        displayName: meUser.displayName,
        avatar: meUser.avatar,
        avatarHue: meUser.avatarHue,
      } : null,
    };
    const replyId = replyTo?.id || null;
    setMessages(prev => [...prev, optimistic]);
    setDraft('');
    setShowReacts(false);
    setReplyTo(null);
    setMentionPicker(null);
    try {
      const sent = await window.API.sendMessage(convId, text, replyId);
      lastMsgAt.current = sent.created_at;
      setMessages(prev => prev.map(m =>
        m.id === optimisticId
          ? mapGameMsg(sent, meUser, home.code, away.code)
          : m
      ));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      if (e?.status === 410) {
        setClosedFully(true);
        setClosedAt(e.data?.closes_at || null);
      }
    }
  };

  // @-mention autocomplete: when the caret follows "@token", show a picker.
  const handleDraftChange = (value) => {
    setDraft(value);
    const el = inputRef.current;
    const caret = el ? el.selectionStart ?? value.length : value.length;
    const upTo = value.slice(0, caret);
    const m = upTo.match(/(?:^|\s)@([a-zA-Z0-9_]{0,20})$/);
    if (!m || !convId) { setMentionPicker(null); return; }
    const query = m[1];
    setMentionPicker({ query, results: [], anchor: caret - m[1].length - 1 });
    window.API.conversationParticipants(convId, query).then(rows => {
      setMentionPicker(prev => prev ? { ...prev, results: rows || [] } : prev);
    }).catch(() => {});
  };
  const insertMention = (u) => {
    const el = inputRef.current;
    const caret = el ? el.selectionStart ?? draft.length : draft.length;
    const before = draft.slice(0, caret).replace(/@[a-zA-Z0-9_]*$/, `@${u.username} `);
    const after = draft.slice(caret);
    const next = before + after;
    setDraft(next);
    setMentionPicker(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = before.length;
        try { inputRef.current.setSelectionRange(pos, pos); } catch {}
      }
    }, 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && mentionPicker) { setMentionPicker(null); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const muteUser = async (m) => {
    if (!m?.user || m.mine) return;
    try {
      await window.API.muteUser(m.user);
      setMessages(prev => prev.filter(x => x.user !== m.user));
    } catch {}
    setActionMsg(null);
  };
  const deleteMessageGameday = async (m) => {
    if (!m?.id || !convId || !m.mine) { setActionMsg(null); return; }
    setActionMsg(null);
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deleted: true, text: 'Message deleted' } : x));
    try { await window.API.deleteMessage(convId, m.id); } catch {}
  };
  const editMessageGameday = async (m) => {
    if (!m?.id || !convId || !m.mine) { setActionMsg(null); return; }
    const next = window.prompt('Edit your message:', m.text);
    setActionMsg(null);
    if (next == null) return;
    const trimmed = String(next).trim();
    if (!trimmed || trimmed === m.text) return;
    try {
      const updated = await window.API.editMessage(convId, m.id, trimmed);
      setMessages(prev => prev.map(x => x.id === m.id
        ? { ...x, text: updated.content, deleted: !!updated.deleted }
        : x));
    } catch {}
  };
  const startReply = (m) => { setReplyTo(m); setActionMsg(null); inputRef.current?.focus(); };
  const startMention = (m) => {
    if (!m?.user) return;
    const tag = `@${m.user} `;
    setDraft(d => d.endsWith(' ') || d.length === 0 ? d + tag : d + ' ' + tag);
    setActionMsg(null);
    inputRef.current?.focus();
  };
  const openProfile = (m) => {
    if (!m?.user) return;
    window.dispatchEvent(new CustomEvent('cntrd:open-user', { detail: { username: m.user } }));
    setActionMsg(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky scoreboard */}
      <div style={{ borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <button onClick={goBack} style={iconBtnStyle()} title="Back to list">
            <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: closedFully ? 'var(--cn-text-mute)' : (isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)'), animation: !closedFully && isLive ? 'cn-pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: closedFully ? 'var(--cn-text-mute)' : (isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)'), fontWeight: 800, letterSpacing: 1 }}>
              {closedFully ? 'GAMEDAY · CLOSED' : (isLive ? 'GAMEDAY · LIVE' : 'GAMEDAY · UPCOMING')}
            </span>
          </div>
          <button onClick={() => onNav?.('notifications')} style={iconBtnStyle()} title="Notifications">
            <Icon name="bell" size={18} stroke="var(--cn-text-dim)" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px' }}>
          <SideTeam team={away} score={game.awayScore} league={game.league} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>{game.period}</div>
            <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{game.clock}</div>
          </div>
          <SideTeam team={home} score={game.homeScore} league={game.league} reverse />
        </div>
        {/* side filter */}
        <div style={{ display: 'flex', padding: '0 12px 10px', gap: 6 }}>
          {[
            { id: 'all', label: 'All fans', color: null },
            { id: away.code, label: `${away.name} only`, color: away.primary },
            { id: home.code, label: `${home.name} only`, color: home.primary },
          ].map(s => (
            <button key={s.id} onClick={() => setSide(s.id)} style={{
              padding: '5px 14px', borderRadius: 999,
              background: side === s.id ? (s.color || 'var(--cn-text)') : 'transparent',
              color: side === s.id ? (s.color ? pickContrast(s.color) : 'var(--cn-bg)') : 'var(--cn-text-dim)',
              border: `0.5px solid ${side === s.id ? 'transparent' : 'var(--cn-border-s)'}`,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--cn-font-body)',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: filtered.length ? 'column-reverse' : 'column', gap: 8, alignItems: filtered.length ? 'stretch' : 'center', justifyContent: filtered.length ? 'flex-end' : 'center' }}>
        {chatLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, padding: '20px 16px' }}>
            Loading chat…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, padding: '20px 16px', lineHeight: 1.6 }}>
            Be the first to chat.
          </div>
        ) : (
          [...filtered].reverse().map(m => <ChatBubble key={m.id} m={m} onTap={() => setActionMsg(m)} />)
        )}
      </div>

      {actionMsg && (
        <ChatActionSheet
          msg={actionMsg}
          onClose={() => setActionMsg(null)}
          onReply={() => startReply(actionMsg)}
          onMention={() => startMention(actionMsg)}
          onMute={() => muteUser(actionMsg)}
          onProfile={() => openProfile(actionMsg)}
          onEdit={() => editMessageGameday(actionMsg)}
          onDelete={() => deleteMessageGameday(actionMsg)}
        />
      )}

      {replyTo && (
        <div style={{
          padding: '8px 12px', borderTop: '0.5px solid var(--cn-border-s)',
          background: 'var(--cn-bg-elev2)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--cn-accent)', borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>
              REPLYING TO @{replyTo.user}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--cn-text-dim)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{replyTo.text}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={iconBtnStyle()} title="Cancel reply">
            <Icon name="x" size={16} stroke="var(--cn-text-dim)" />
          </button>
        </div>
      )}

      {mentionPicker && mentionPicker.results.length > 0 && (
        <div style={{
          borderTop: '0.5px solid var(--cn-border-s)',
          background: 'var(--cn-bg-elev2)', maxHeight: 220, overflowY: 'auto',
        }}>
          {mentionPicker.results.map(u => (
            <button key={u.id} onClick={() => insertMention(u)} style={{
              width: '100%', padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--cn-text)', textAlign: 'left',
            }}>
              <Avatar user={u} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.displayName}</div>
                <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 11, color: 'var(--cn-text-mute)' }}>@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* quick-react popover */}
      {showReacts && (
        <div style={{
          padding: '6px 12px',
          borderTop: '0.5px solid var(--cn-border-s)',
          background: 'var(--cn-bg-elev2)',
          display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {CHAT_QUICK_REACTS.map(e => (
            <button key={e} onClick={() => { setDraft(d => d + e); }} style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--cn-bg-elev)',
              border: '0.5px solid var(--cn-border-s)',
              fontSize: 18, cursor: 'pointer',
            }} title={`Add ${e}`}>{e}</button>
          ))}
        </div>
      )}

      {closedFully ? (
        <div style={{
          padding: '14px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
          borderTop: '0.5px solid var(--cn-border)',
          background: 'var(--cn-bg-elev2)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 11,
            color: 'var(--cn-text-mute)', letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 4,
          }}>CHAT CLOSED</div>
          <div style={{ fontSize: 12, color: 'var(--cn-text-dim)', lineHeight: 1.4 }}>
            This gameday chat closed 24 hours after the game ended.
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 12px 28px', borderTop: '0.5px solid var(--cn-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowReacts(s => !s)}
            title={showReacts ? 'Hide reactions' : 'Quick reactions'}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: showReacts ? 'var(--cn-accent)' : 'var(--cn-bg-elev)',
              color: showReacts ? 'var(--cn-on-accent)' : 'var(--cn-text-dim)',
              border: '0.5px solid var(--cn-border-s)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="plus" size={18} />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={replyTo ? `Reply to @${replyTo.user}` : 'Yell about it...'}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
              color: 'var(--cn-text)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--cn-font-body)',
            }}
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || !convId}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: draft.trim() && convId ? 'var(--cn-accent)' : 'var(--cn-bg-elev2)',
              color: draft.trim() && convId ? 'var(--cn-on-accent)' : 'var(--cn-text-mute)',
              border: 'none', fontWeight: 700, fontSize: 13,
              cursor: draft.trim() && convId ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--cn-font-body)',
            }}
          >Send</button>
        </div>
      )}
    </div>
  );
}

function SideTeam({ team, score, reverse, league }) {
  const interactive = !!(team?.id && league);
  const openSchedule = (e) => {
    if (!interactive) return;
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('cntrd:open-team-schedule', {
      detail: {
        league, teamId: team.id, name: team.name,
        primary: team.primary, code: team.code, logo: team.logo,
      },
    }));
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: reverse ? 'row-reverse' : 'row' }}>
      <button
        type="button"
        onClick={openSchedule}
        disabled={!interactive}
        title={interactive ? `See ${team.name}'s schedule` : team?.name || ''}
        style={{
          background: 'transparent', border: 'none', padding: 0,
          cursor: interactive ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <TeamLogo team={team} size={36} radius={8} />
      </button>
      <div style={{ textAlign: reverse ? 'right' : 'left' }}>
        <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
        <button
          type="button"
          onClick={openSchedule}
          disabled={!interactive}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: interactive ? 'pointer' : 'default',
            fontFamily: 'var(--cn-font-mono)', fontSize: 9,
            color: 'var(--cn-text-mute)', letterSpacing: 0.5, textTransform: 'uppercase',
          }}
        >{team?.name || ''}</button>
      </div>
    </div>
  );
}

// Render text with @-mentions as clickable spans.
function renderMentions(text, accent) {
  const out = [];
  const re = /@([a-zA-Z0-9_]{3,20})/g;
  let last = 0, i = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const username = m[1];
    out.push(
      <button
        key={`mention-${i++}`}
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('cntrd:open-user', { detail: { username } }));
        }}
        style={{
          background: 'transparent', border: 'none', padding: 0,
          color: accent, fontWeight: 700, cursor: 'pointer',
          font: 'inherit',
        }}
      >@{username}</button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ChatBubble({ m, onTap }) {
  const u = m.meSnapshot || { username: m.user || 'me', displayName: m.user || 'Me' };
  const isMine = m.mine;
  const team = m.side ? TEAMS[m.side] : null;
  const openProfile = (e) => {
    if (!u?.username) return;
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('cntrd:open-user', { detail: { username: u.username } }));
  };
  const clickable = !!u?.username;
  const linkBtnStyle = {
    background: 'transparent', border: 'none', padding: 0, margin: 0,
    cursor: clickable ? 'pointer' : 'default',
    color: 'inherit', font: 'inherit',
  };
  const mentionAccent = isMine ? 'var(--cn-on-accent)' : 'var(--cn-accent)';
  return (
    <div style={{
      display: 'flex', gap: 8,
      alignItems: 'flex-start',
      flexDirection: isMine ? 'row-reverse' : 'row',
    }}>
      {!isMine && (
        <button onClick={openProfile} disabled={!clickable} title={clickable ? `@${u.username}` : ''} style={linkBtnStyle}>
          <Avatar user={u} size={26} />
        </button>
      )}
      <div style={{ maxWidth: '75%' }}>
        {!isMine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <button onClick={openProfile} disabled={!clickable} style={{ ...linkBtnStyle, fontSize: 11, fontWeight: 700, color: 'var(--cn-text-dim)' }}>
              {displayHandle(u) || u.displayName || u.username}
            </button>
            {team && <TeamPill code={team.code} size="xs" />}
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)' }}>{m.time}</span>
          </div>
        )}
        <div
          onClick={() => !m.deleted && onTap?.(m)}
          style={{
            padding: '8px 12px', borderRadius: 14,
            background: m.deleted ? 'transparent' : (isMine ? 'var(--cn-accent)' : team
              ? `color-mix(in srgb, ${team.primary} 15%, var(--cn-bg-elev))`
              : 'var(--cn-bg-elev)'),
            color: m.deleted ? 'var(--cn-text-mute)' : (isMine ? 'var(--cn-on-accent)' : 'var(--cn-text)'),
            fontSize: 13.5, lineHeight: 1.4,
            borderLeft: !m.deleted && !isMine && team ? `2px solid ${team.primary}` : 'none',
            border: m.deleted ? '0.5px dashed var(--cn-border)' : (isMine ? 'none' : 'none'),
            borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            cursor: m.deleted ? 'default' : (onTap ? 'pointer' : 'default'),
            fontStyle: m.deleted ? 'italic' : 'normal',
          }}
        >
          {m.reply_to && !m.deleted && (
            <div style={{
              borderLeft: `2px solid ${isMine ? 'var(--cn-on-accent)' : 'var(--cn-accent)'}`,
              paddingLeft: 6, marginBottom: 4,
              opacity: 0.85, fontSize: 11.5, lineHeight: 1.3,
            }}>
              <div style={{ fontWeight: 700, fontSize: 10, opacity: 0.9 }}>
                {m.reply_to.displayName || '@' + m.reply_to.username}
              </div>
              <div style={{
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                fontStyle: m.reply_to.deleted ? 'italic' : 'normal',
                opacity: m.reply_to.deleted ? 0.6 : 1,
              }}>{m.reply_to.content}</div>
            </div>
          )}
          {m.deleted ? 'Message deleted' : renderMentions(m.text, mentionAccent)}
        </div>
        {isMine && m.time && (
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 9,
            color: 'var(--cn-text-mute)',
            marginTop: 3, textAlign: 'right',
          }}>{m.time}{m.edited && !m.deleted ? ' · edited' : ''}</div>
        )}
        {!isMine && m.edited && !m.deleted && (
          <div style={{
            fontFamily: 'var(--cn-font-mono)', fontSize: 9,
            color: 'var(--cn-text-mute)',
            marginTop: 3,
          }}>edited</div>
        )}
      </div>
    </div>
  );
}

function ChatActionSheet({ msg, onClose, onReply, onMention, onMute, onProfile, onEdit, onDelete }) {
  const u = msg.meSnapshot || { username: msg.user, displayName: msg.user };
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: 'var(--cn-bg-elev2)',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        padding: '10px 0 calc(28px + env(safe-area-inset-bottom, 0px))',
        color: 'var(--cn-text)',
      }}>
        <div style={{ padding: '10px 18px 12px', borderBottom: '0.5px solid var(--cn-border-s)' }}>
          <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>
            FROM @{u.username}
          </div>
          <div style={{
            marginTop: 4, fontSize: 13, color: 'var(--cn-text-dim)',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{msg.text}</div>
        </div>
        {!msg.deleted && <ActionRow icon="reply" label="Reply" onClick={onReply} />}
        {!msg.mine && !msg.deleted && <ActionRow icon="chat" label={`Mention @${u.username}`} onClick={onMention} />}
        {!msg.mine && <ActionRow icon="profile" label="View profile" onClick={onProfile} />}
        {!msg.mine && <ActionRow icon="bell" label="Mute user" onClick={onMute} danger />}
        {msg.mine && !msg.deleted && onEdit && <ActionRow icon="text" label="Edit" onClick={onEdit} />}
        {msg.mine && !msg.deleted && onDelete && <ActionRow icon="x" label="Delete" onClick={onDelete} danger />}
        <ActionRow icon="x" label="Cancel" onClick={onClose} />
      </div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: danger ? 'var(--cn-danger)' : 'var(--cn-text)',
      fontSize: 14, fontWeight: 600, textAlign: 'left',
      fontFamily: 'var(--cn-font-body)',
    }}>
      <Icon name={icon} size={18} stroke={danger ? 'var(--cn-danger)' : 'var(--cn-text)'} />
      {label}
    </button>
  );
}

Object.assign(window, { LoginScreen, SignupScreen, SettingsScreen, GamedayScreen, passwordChecks, passwordOK, PasswordChecklist, ChatBubble, ChatActionSheet, renderMentions });
