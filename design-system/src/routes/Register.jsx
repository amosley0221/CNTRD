import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Logo, Eyebrow } from '../components';
import { Field } from './Login';
import { useAuth } from '../auth/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || username.trim(),
      });
      nav('/feed', { replace: true });
    } catch (e) {
      setErr(e.message || 'Could not create account.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ paddingTop: 60, paddingBottom: 60 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 420 }}>
        <div className="mb-8 flex justify-center"><Logo className="text-4xl" /></div>
        <Eyebrow>Create account</Eyebrow>
        <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(32px, 5.5vw, 48px)', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 28 }}>
          Join the <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>league</em>.
        </h1>

        <Field label="DISPLAY NAME" value={displayName} onChange={setDisplayName} autoComplete="name" />
        <Field label="USERNAME" value={username} onChange={setUsername} autoComplete="username" />
        <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="PASSWORD" type="password" value={password} onChange={setPassword} autoComplete="new-password" />

        {err && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, letterSpacing: '0.05em', marginTop: 8, marginBottom: 12 }}>
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !username || !email || !password}
          style={{
            width: '100%',
            padding: '14px 18px',
            background: c.accent,
            color: c.paper,
            border: 'none',
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending || !username || !email || !password ? 0.55 : 1,
            marginTop: 12,
          }}
        >
          {pending ? 'Creating…' : 'Create account'}
        </button>

        <div className="mt-6" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em', textAlign: 'center' }}>
          Already on cntrd? <Link to="/login" style={{ color: c.accent, marginLeft: 6 }}>SIGN IN →</Link>
        </div>
      </form>
    </div>
  );
}
