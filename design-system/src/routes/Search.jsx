import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Avatar } from '../components';
import { search as searchApi } from '../api';

export default function Search() {
  const [q, setQ] = useState('');
  const [data, setData] = useState({ users: [], posts: [] });
  const [pending, setPending] = useState(false);
  const tRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setData({ users: [], posts: [] }); return; }
    if (tRef.current) clearTimeout(tRef.current);
    setPending(true);
    tRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.query(q.trim());
        setData(res || { users: [], posts: [] });
      } catch {
        setData({ users: [], posts: [] });
      } finally {
        setPending(false);
      }
    }, 220);
    return () => tRef.current && clearTimeout(tRef.current);
  }, [q]);

  return (
    <>
      <Eyebrow>Search</Eyebrow>

      <div className="flex items-center gap-3 mb-6" style={{ borderBottom: `1px solid ${c.inkFaint}`, paddingBottom: 8 }}>
        <SearchIcon size={18} color={c.inkDim} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users or posts"
          style={{
            flex: 1, padding: '8px 0', background: 'transparent', border: 'none',
            outline: 'none', fontFamily: fonts.body, fontSize: 17, color: c.ink,
          }}
        />
        {pending && <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>SEARCHING…</span>}
      </div>

      {q.trim().length >= 2 && (
        <>
          <Section title="Users" count={data.users.length}>
            {data.users.map((u) => {
              const display = u.displayName || u.display_name || u.username;
              const initial = (display[0] || '?').toUpperCase();
              return (
                <Link
                  key={u.id}
                  to={`/u/${u.username}`}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: `1px solid ${c.line}`, textDecoration: 'none', color: 'inherit' }}
                >
                  <Avatar initial={initial} />
                  <div className="flex-1">
                    <div style={{ fontFamily: fonts.display, fontSize: 16, color: c.ink, fontWeight: 500 }}>{display}</div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>@{u.username}</div>
                  </div>
                </Link>
              );
            })}
          </Section>

          <Section title="Posts" count={data.posts.length}>
            {data.posts.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="block py-3" style={{ borderBottom: `1px solid ${c.line}`, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, marginBottom: 4 }}>
                  @{p.user?.username || 'anon'}
                </div>
                <div style={{ fontFamily: fonts.display, fontSize: 17, lineHeight: 1.4, fontWeight: 300, color: c.ink, whiteSpace: 'pre-wrap' }}>
                  {p.content || p.text}
                </div>
              </Link>
            ))}
          </Section>
        </>
      )}

      {q.trim().length < 2 && (
        <div style={{ fontFamily: fonts.body, fontSize: 16, color: c.inkSoft, padding: '12px 0' }}>
          Type at least two characters.
        </div>
      )}
    </>
  );
}

function Section({ title, count, children }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h3 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: c.ink }}>{title}</h3>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.15em' }}>{count}</span>
      </div>
      {empty
        ? <div style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft, padding: '4px 0' }}>No matches.</div>
        : <div style={{ maxWidth: 640 }}>{children}</div>}
    </section>
  );
}
