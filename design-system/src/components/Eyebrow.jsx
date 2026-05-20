import { c, fonts } from '../tokens';

export default function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-3 mb-6" style={{ color: c.accent }}>
      <span className="block w-8 h-px" style={{ background: c.accent }} />
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}
