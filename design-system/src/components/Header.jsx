import { useState, useEffect } from 'react';
import { c, fonts } from '../tokens';
import Logo from './Logo';
import LiveDot from './LiveDot';

export default function Header({ liveCount = 14 }) {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = clock.toLocaleDateString([], { weekday: 'short' }).toUpperCase();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{ background: c.paper + 'd9', borderBottom: `1px solid ${c.line}` }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 md:px-12">
        <Logo />
        <div className="flex items-center gap-4" style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.1em' }}>
          <span className="flex items-center gap-1.5" style={{ color: c.alert, textTransform: 'uppercase' }}>
            <LiveDot tone="alert" />{liveCount} LIVE
          </span>
          <span>{day} · {time}</span>
        </div>
      </div>
    </header>
  );
}
