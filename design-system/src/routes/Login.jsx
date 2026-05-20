import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Logo, Eyebrow, Pill } from '../components';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from || '/feed';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await login(identifier.trim(), password);
      nav(from, { replace: true });
    } catch (e) {
      setErr(e.message || 'Could not sign in.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 420 }}>
        <div className="mb-8 flex justify-center"><Logo className="text-4xl" /></div>
        <Eyebrow>Sign in</Eyebrow>

        <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(34px, 6vw, 52px)', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 28 }}>
          Welcome <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>back</em>.
        </h1>

        <Field
          label="USERNAME OR EMAIL"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          autoFocus
        />
        <Field
          label="PASSWORD"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {err && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, letterSpacing: '0.05em', marginTop: 8, marginBottom: 12 }}>
            {err}
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={pending || !identifier || !password}
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
              opacity: pending || !identifier || !password ? 0.55 : 1,
            }}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <div className="flex justify-between items-center mt-6" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>
          <Link to="/register" style={{ color: c.accent }}>CREATE ACCOUNT →</Link>
          <span>or</span>
          <Link to="/_showcase" style={{ color: c.inkDim }}>SHOWCASE</Link>
        </div>
      </form>
    </div>
  );
}

export function Field({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <label className="block mb-4">
      <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'transparent',
          border: `1px solid ${c.inkFaint}`,
          color: c.ink,
          fontFamily: fonts.body,
          fontSize: 15,
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = c.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
        {...rest}
      />
    </label>
  );
}
