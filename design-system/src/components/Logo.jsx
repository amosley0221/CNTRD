import { c, fonts } from '../tokens';

export default function Logo({ className = 'text-2xl' }) {
  return (
    <span className={className} style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '-0.04em' }}>
      cntrd<span style={{ color: c.accent }}>.</span>
    </span>
  );
}
