// mobile-auth.jsx — signup, login, settings, gameday chat for CNTRD

// ─── LOGIN ────────────────────────────────────────────────────
function LoginScreen({ tweaks, onNav, onLogin }) {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const submit = async () => {
    if (!email || !pw || busy) return;
    setBusy(true); setErr(null);
    try {
      if (onLogin) await onLogin({ login: email.trim(), password: pw });
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
          <Field label="Email or username" value={email} onChange={setEmail} placeholder="you@email.com" />
          <Field label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password" />
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

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
        borderRadius: 10, padding: '12px 14px',
        color: 'var(--cn-text)', fontSize: 15,
        outline: 'none', fontFamily: 'var(--cn-font-body)',
      }} />
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

  const stepValid =
    step === 0 ? (email.includes('@') && passwordOK(password)) :
    step === 1 ? (username.length >= 3) :
    step === 2 ? true :
    step === 3 ? (picks.length > 0) :
    /* step 4 */ (leaguePicks.length > 0);

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
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="8+ chars, 1 capital, 1 number, 1 symbol" type="password" />
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
            <Subhead>Tap a league to expand. Pick as many as you want — at least one. You can change these any time from Settings.</Subhead>
            <div style={{ marginTop: 18 }}>
              <LeaguePicker picks={picks} onTogglePick={togglePick} />
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <H1>Follow leagues</H1>
            <Subhead>These decide what you see in Next Up + Recent Finals. Your favorite teams' leagues are pre-selected. Add UFC, golf, tennis, racing, or anything else you watch.</Subhead>
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
              ? 'Continue'
              : `Finish · ${picks.length} team${picks.length === 1 ? '' : 's'} · ${leaguePicks.length} league${leaguePicks.length === 1 ? '' : 's'}`)}</button>
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
function SettingsScreen({ tweaks, setTweak, onNav, me, onMeUpdated, unreadNotifs }) {
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
        <button style={iconBtnStyle()} onClick={() => onNav?.('profile')}>
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
            <div style={{ display: 'flex', gap: 6 }}>
              {['#D4FF3A','#FF3B30','#3B82F6','#FB923C','#A855F7'].map(c => (
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
            onClick={() => onNav?.('account')}
          />
          <Row
            label="Email"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meUser.email || '—'}</span>
                <Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />
              </div>
            }
            onClick={() => onNav?.('account')}
          />
          <Row
            label="Change password"
            right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />}
            onClick={() => onNav?.('account')}
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
            onClick={() => onNav?.('account')}
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
function GamedayList({ tweaks, onNav, games, me, onPick }) {
  const live     = games?.live     || [];
  const upcoming = games?.upcoming || [];

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

  // Partition each group; "your teams" combines live+upcoming favorites,
  // live ones rendered first.
  const yourLive     = live.filter(matches);
  const yourUpcoming = upcoming.filter(matches);
  const yours        = [...yourLive, ...yourUpcoming];
  const otherLive    = live.filter(g => !matches(g));
  const otherUpcoming = upcoming.filter(g => !matches(g));

  const empty = !live.length && !upcoming.length;
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <button onClick={() => onNav?.('home')} style={iconBtnStyle()}>
          <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
        </button>
        <span style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 14 }}>GAMEDAY</span>
        <span style={{ width: 32 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {empty ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)', textTransform: 'var(--cn-display-case)', letterSpacing: 'var(--cn-display-spacing)', fontSize: 22 }}>No games right now</div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--cn-text-dim)', lineHeight: 1.45 }}>
              When a game tips off or one's scheduled today, you'll see it here.
            </div>
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
            {otherLive.length > 0    && <GamedayGroup label={yours.length ? 'OTHER LIVE NOW' : 'LIVE NOW'} live items={otherLive} onPick={onPick} />}
            {otherUpcoming.length > 0 && <GamedayGroup label={yours.length ? 'OTHER UP NEXT' : 'UP NEXT'} items={otherUpcoming} onPick={onPick} />}
          </>
        )}
      </div>
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
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--cn-border)',
      cursor: 'pointer',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--cn-font-display)', fontWeight: 'var(--cn-display-weight)' }}>
          <TeamMini team={away} />
          <span style={{ color: 'var(--cn-text-mute)', fontSize: 11, fontFamily: 'var(--cn-font-mono)' }}>@</span>
          <TeamMini team={home} />
          {favorite && <span title="Your team" style={{ color: 'var(--cn-accent)', fontSize: 12, fontWeight: 800 }}>★</span>}
        </div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', marginTop: 4 }}>
          {game.league} · {game.period || (live ? 'LIVE' : 'Scheduled')}
        </div>
      </div>
      {live ? (
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

function TeamMini({ team }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 5,
        background: team.primary, color: pickContrast(team.primary),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
      }}>{team.code}</span>
      <span style={{ fontSize: 14 }}>{team.name}</span>
    </span>
  );
}

function GamedayScreen({ tweaks, onNav, games, gamedayPick, setGamedayPick, me }) {
  const [side, setSide] = React.useState('all');
  // List mode: no specific game picked → show live + upcoming as rows.
  if (!gamedayPick) {
    return <GamedayList tweaks={tweaks} onNav={onNav} games={games} me={me} onPick={setGamedayPick} />;
  }
  const game = gamedayPick;
  const home = game.homeTeam || TEAMS[game.home] || { code: game.home, name: game.home, primary: '#666', accent: '#999' };
  const away = game.awayTeam || TEAMS[game.away] || { code: game.away, name: game.away, primary: '#666', accent: '#999' };
  const isLive = game.state === 'live';
  const filtered = side === 'all' ? CHAT_MESSAGES : CHAT_MESSAGES.filter(m => m.side === side || !m.side);
  const goBack = () => setGamedayPick?.(null);
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky scoreboard */}
      <div style={{ borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <button onClick={goBack} style={iconBtnStyle()} title="Back to list">
            <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', animation: isLive ? 'cn-pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: isLive ? 'var(--cn-live)' : 'var(--cn-text-mute)', fontWeight: 800, letterSpacing: 1 }}>{isLive ? 'GAMEDAY · LIVE' : 'GAMEDAY · UPCOMING'}</span>
          </div>
          <button style={iconBtnStyle()}>
            <Icon name="bell" size={18} stroke="var(--cn-text-dim)" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px' }}>
          <SideTeam team={away} score={game.awayScore} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1 }}>{game.period}</div>
            <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{game.clock}</div>
          </div>
          <SideTeam team={home} score={game.homeScore} reverse />
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
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)', fontSize: 11, padding: '20px 16px', lineHeight: 1.6 }}>
            Be the first to chat.<br />
            <span style={{ fontSize: 10 }}>Live chat is wired client-side only for now — messages will sync when the realtime backend ships.</span>
          </div>
        ) : (
          filtered.map(m => <ChatBubble key={m.id} m={m} />)
        )}
      </div>

      {/* input */}
      <div style={{ padding: '10px 12px 28px', borderTop: '0.5px solid var(--cn-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cn-text-dim)', cursor: 'pointer' }}>
          <Icon name="plus" size={18} />
        </button>
        <input placeholder="Yell about it..." style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          background: 'var(--cn-bg-elev)', border: '0.5px solid var(--cn-border-s)',
          color: 'var(--cn-text)', fontSize: 13, outline: 'none',
          fontFamily: 'var(--cn-font-body)',
        }} />
        <button style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--cn-accent)', color: 'var(--cn-on-accent)', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--cn-font-body)' }}>Send</button>
      </div>
    </div>
  );
}

function SideTeam({ team, score, reverse }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: reverse ? 'row-reverse' : 'row' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: team.primary, color: pickContrast(team.primary), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{team.code}</div>
      <div style={{ textAlign: reverse ? 'right' : 'left' }}>
        <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
        <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{team.name}</div>
      </div>
    </div>
  );
}

function ChatBubble({ m }) {
  const u = USERS[m.user];
  const isMine = m.mine;
  const team = m.side ? TEAMS[m.side] : null;
  return (
    <div style={{
      display: 'flex', gap: 8,
      alignItems: 'flex-start',
      flexDirection: isMine ? 'row-reverse' : 'row',
    }}>
      {!isMine && <Avatar user={u} size={26} />}
      <div style={{ maxWidth: '75%' }}>
        {!isMine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cn-text-dim)' }}>@{u.username}</span>
            {team && <TeamPill code={team.code} size="xs" />}
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 9, color: 'var(--cn-text-mute)' }}>{m.time}</span>
          </div>
        )}
        <div style={{
          padding: '8px 12px', borderRadius: 14,
          background: isMine ? 'var(--cn-accent)' : team
            ? `color-mix(in srgb, ${team.primary} 15%, var(--cn-bg-elev))`
            : 'var(--cn-bg-elev)',
          color: isMine ? 'var(--cn-on-accent)' : 'var(--cn-text)',
          fontSize: 13.5, lineHeight: 1.4,
          borderLeft: !isMine && team ? `2px solid ${team.primary}` : 'none',
          borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        }}>{m.text}</div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, SignupScreen, SettingsScreen, GamedayScreen, passwordChecks, passwordOK, PasswordChecklist });
