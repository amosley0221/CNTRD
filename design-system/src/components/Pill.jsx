import { c, fonts } from '../tokens';

export default function Pill({ children, primary, onClick, active }) {
  const isActive = primary || active;
  return (
    <button
      onClick={onClick}
      className="transition-all duration-200 cursor-pointer"
      style={{
        fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.15em',
        textTransform: 'uppercase', padding: '8px 14px',
        border: `1px solid ${isActive ? c.accent : c.inkFaint}`,
        color: isActive ? c.accent : c.ink, background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isActive ? c.accent : c.inkFaint; e.currentTarget.style.color = isActive ? c.accent : c.ink; }}
    >
      {children}
    </button>
  );
}
