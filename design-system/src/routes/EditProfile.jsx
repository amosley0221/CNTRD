import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow } from '../components';
import { users as usersApi } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function EditProfile() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState(me?.display_name || me?.displayName || '');
  const [bio, setBio] = useState(me?.bio || '');
  const [city, setCity] = useState(me?.city || '');
  const [pronouns, setPronouns] = useState(me?.pronouns || '');
  const [isPrivate, setPrivate] = useState(!!me?.is_private);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  if (!me) return <div style={{ fontFamily: fonts.body, color: c.inkSoft }}>Sign in to edit your profile.</div>;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setErr(null);
    try {
      await usersApi.updateMe({
        display_name: displayName.trim() || me.username,
        bio: bio.trim(),
        city: city.trim(),
        pronouns: pronouns.trim(),
        is_private: isPrivate,
      });
      await refresh();
      nav('/me');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Eyebrow>Edit profile</Eyebrow>
      <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 300, letterSpacing: '-0.03em', marginBottom: 24 }}>
        Your <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>profile</em>
      </h1>

      <Row label="DISPLAY NAME" value={displayName} onChange={setDisplayName} max={50} />
      <Row label="BIO · 160" value={bio} onChange={setBio} max={160} multiline />
      <Row label="CITY" value={city} onChange={setCity} max={80} />
      <Row label="PRONOUNS" value={pronouns} onChange={setPronouns} max={30} />

      <label className="flex items-center gap-3 my-5">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} style={{ accentColor: c.accent, width: 18, height: 18 }} />
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', color: c.ink }}>
          PRIVATE ACCOUNT — followers must be approved
        </span>
      </label>

      {err && <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, marginBottom: 12 }}>{err}</div>}

      <div className="flex gap-3 mt-4">
        <button type="button" onClick={() => nav('/me')} style={btn('transparent', c.ink, { border: `1px solid ${c.inkFaint}` })}>Cancel</button>
        <button type="submit" disabled={saving} style={btn(c.accent, c.paper, { opacity: saving ? 0.6 : 1 })}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function Row({ label, value, onChange, max, multiline }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <label className="block mb-4">
      <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 6 }}>{label}</div>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={multiline ? 3 : undefined}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'transparent', border: `1px solid ${c.inkFaint}`,
          color: c.ink, fontFamily: fonts.body, fontSize: 15, outline: 'none', resize: multiline ? 'vertical' : 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = c.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
      />
    </label>
  );
}

function btn(bg, color, extra) {
  return {
    background: bg, color, border: extra?.border || 'none', cursor: 'pointer',
    padding: '12px 18px',
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    ...(extra || {}),
  };
}
