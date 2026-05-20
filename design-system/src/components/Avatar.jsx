import { c, fonts } from '../tokens';

export default function Avatar({ initial }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 32, height: 32, background: c.surface,
        border: `1px solid ${c.line}`,
        fontFamily: fonts.display, fontWeight: 600, fontSize: 13, color: c.ink,
      }}
    >
      {initial}
    </div>
  );
}
