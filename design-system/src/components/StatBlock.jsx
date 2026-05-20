import { useState, useEffect } from 'react';
import { c, fonts } from '../tokens';

export default function StatBlock({ value, unit, label, delta, deltaDirection = 'up', animate = true }) {
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) return;
    const target = parseFloat(value);
    const duration = 1400;
    const start = performance.now();
    let frame;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(eased * target);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  const display = Number.isInteger(parseFloat(value)) ? Math.round(shown) : shown.toFixed(1);
  const deltaColor = deltaDirection === 'down' ? c.alert : c.accent;

  return (
    <div className="flex flex-col gap-1.5">
      <div style={{
        fontFamily: fonts.display, fontWeight: 200,
        fontSize: 'clamp(48px, 10vw, 72px)', lineHeight: 0.9,
        letterSpacing: '-0.04em', color: c.ink, fontVariantNumeric: 'tabular-nums',
      }}>
        {display}
        {unit && <span style={{ fontSize: '0.4em', color: c.inkDim, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', color: c.inkDim, textTransform: 'uppercase' }}>
        {label}
      </div>
      {delta && (
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: deltaColor, letterSpacing: '0.05em' }}>
          {deltaDirection === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}
