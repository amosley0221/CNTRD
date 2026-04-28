// mobile-auth.jsx — signup, login, settings, gameday chat for CNTRD

// ─── LOGIN ────────────────────────────────────────────────────
function LoginScreen({ tweaks, onNav }) {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column', padding: '60px 24px 40px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--cn-font-display)', fontWeight: 800, fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>CNTRD</div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--cn-text-dim)', fontStyle: 'italic' }}>Where the game gets loud.</div>

        <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
          <Field label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password" />
          <button onClick={() => onNav?.('home')} style={{
            marginTop: 8, padding: '14px', borderRadius: 12,
            background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
            border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            fontFamily: 'var(--cn-font-body)',
          }}>Sign in</button>
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

// ─── SIGNUP / ONBOARDING ──────────────────────────────────────
function SignupScreen({ tweaks, onNav }) {
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [picks, setPicks] = React.useState([]);
  const [avatarHue, setAvatarHue] = React.useState(280);

  const togglePick = (code) => {
    setPicks(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={() => step > 0 ? setStep(step - 1) : onNav?.('login')} style={iconBtnStyle()}>
          <Icon name="chevron-l" size={20} stroke="var(--cn-text)" />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 24, height: 3, borderRadius: 2, background: i <= step ? 'var(--cn-accent)' : 'var(--cn-border)' }} />
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
              <Field label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" />
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
            <Subhead>These show next to your name. Tap as many as you want — pick at least one.</Subhead>
            <div style={{ marginTop: 18 }}>
              {Object.entries(
                Object.values(TEAMS).reduce((acc, t) => { (acc[t.league] = acc[t.league] || []).push(t); return acc; }, {})
              ).map(([league, list]) => (
                <div key={league} style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, letterSpacing: 1, color: 'var(--cn-text-mute)', marginBottom: 6, textTransform: 'uppercase' }}>{league}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {list.map(t => {
                      const sel = picks.includes(t.code);
                      return (
                        <button key={t.code} onClick={() => togglePick(t.code)} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', borderRadius: 999,
                          background: sel ? t.primary : 'var(--cn-bg-elev)',
                          border: `0.5px solid ${sel ? t.primary : 'var(--cn-border-s)'}`,
                          color: sel ? pickContrast(t.primary) : 'var(--cn-text)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'var(--cn-font-body)',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sel ? t.accent : t.primary }} />
                          {t.name}
                          {sel && <Icon name="check" size={12} stroke={pickContrast(t.primary)} sw={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '12px 24px 28px', borderTop: '0.5px solid var(--cn-border)' }}>
        <button onClick={() => step < 3 ? setStep(step + 1) : onNav?.('home')} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: 'var(--cn-accent)', color: 'var(--cn-on-accent)',
          border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          fontFamily: 'var(--cn-font-body)',
        }}>{step < 3 ? 'Continue' : `Finish · ${picks.length} team${picks.length === 1 ? '' : 's'}`}</button>
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
function SettingsScreen({ tweaks, setTweak, onNav }) {
  const Section = ({ title, children }) => (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 1, textTransform: 'uppercase', padding: '0 16px 6px' }}>{title}</div>
      <div style={{ background: 'var(--cn-bg-elev)', borderTop: '0.5px solid var(--cn-border)', borderBottom: '0.5px solid var(--cn-border)' }}>{children}</div>
    </div>
  );
  const Row = ({ label, sub, right, last }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: last ? 'none' : '0.5px solid var(--cn-border)', minHeight: 52 }}>
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
          <Row label="Username" right={<span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>@{ME.username}</span>} />
          <Row label="Email" right={<span style={{ fontSize: 13, color: 'var(--cn-text-mute)', fontFamily: 'var(--cn-font-mono)' }}>m••••@gmail.com</span>} />
          <Row label="Change password" right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} />
          <Row label="Profile picture" right={<Avatar user={ME} size={28} />} last />
        </Section>

        <Section title="Teams">
          <Row label="My teams" sub="Showing on your username" right={<TeamTagsRow codes={ME.teams} size="sm" />} last />
        </Section>

        <Section title="Notifications">
          <Row label="Live game alerts" right={<ToggleSwitch on={true} onChange={() => {}} />} />
          <Row label="Trade rumors" right={<ToggleSwitch on={true} onChange={() => {}} />} />
          <Row label="Replies & mentions" right={<ToggleSwitch on={true} onChange={() => {}} />} last />
        </Section>

        <Section title="More">
          <Row label="Privacy" right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} />
          <Row label="About CNTRD" sub="v2.4 · build 1284" right={<Icon name="chevron-r" size={14} stroke="var(--cn-text-mute)" />} />
          <Row label={<span style={{ color: 'var(--cn-danger)' }}>Sign out</span>} right={<Icon name="logout" size={16} stroke="var(--cn-danger)" />} last />
        </Section>
      </div>
    </div>
  );
}

// ─── GAMEDAY CHAT ─────────────────────────────────────────────
function GamedayScreen({ tweaks, onNav }) {
  const game = LIVE_GAMES[0]; // LAL @ BOS
  const home = TEAMS[game.home], away = TEAMS[game.away];
  const [side, setSide] = React.useState('all');
  const filtered = side === 'all' ? CHAT_MESSAGES : CHAT_MESSAGES.filter(m => m.side === side || !m.side);
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--cn-bg)', color: 'var(--cn-text)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky scoreboard */}
      <div style={{ borderBottom: '0.5px solid var(--cn-border)', background: 'var(--cn-bg-elev2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <button onClick={() => onNav?.('home')} style={iconBtnStyle()}>
            <Icon name="chevron-l" size={22} stroke="var(--cn-text)" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cn-live)' }} />
            <span style={{ fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-live)', fontWeight: 800, letterSpacing: 1 }}>GAMEDAY · {game.viewers.toLocaleString()} HERE</span>
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
            { id: 'all', label: 'All', color: null },
            { id: away.code, label: away.code, color: away.primary },
            { id: home.code, label: home.code, color: home.primary },
          ].map(s => (
            <button key={s.id} onClick={() => setSide(s.id)} style={{
              padding: '5px 14px', borderRadius: 999,
              background: side === s.id ? (s.color || 'var(--cn-text)') : 'transparent',
              color: side === s.id ? (s.color ? pickContrast(s.color) : 'var(--cn-bg)') : 'var(--cn-text-dim)',
              border: `0.5px solid ${side === s.id ? 'transparent' : 'var(--cn-border-s)'}`,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--cn-font-body)',
            }}>
              {s.label === 'All' ? 'All fans' : `${TEAMS[s.id].name} only`}
            </button>
          ))}
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
        {filtered.map(m => <ChatBubble key={m.id} m={m} />)}
        {/* play-by-play interjections */}
        <div style={{ alignSelf: 'center', margin: '6px 0', padding: '4px 12px', borderRadius: 999, background: 'var(--cn-bg-elev)', fontFamily: 'var(--cn-font-mono)', fontSize: 10, color: 'var(--cn-text-mute)', letterSpacing: 0.5 }}>
          📣 4:35 · J. Tatum makes 3PT (88-91)
        </div>
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

Object.assign(window, { LoginScreen, SignupScreen, SettingsScreen, GamedayScreen });
