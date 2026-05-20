import { c, fonts } from '../tokens';

export default function TeamMark({ code, color, size = 26 }) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 2,
        background: color, color: c.paper,
        fontFamily: fonts.mono, fontSize: size < 30 ? 10 : 14, fontWeight: 700,
      }}
    >
      {code}
    </span>
  );
}
