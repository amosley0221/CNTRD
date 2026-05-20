import { c, fonts } from '../tokens';

export default function SectionHead({ title, italicWord, count }) {
  return (
    <div className="flex justify-between items-baseline mb-8">
      <h2 style={{ fontFamily: fonts.display, fontWeight: 400, fontSize: 'clamp(26px, 5.5vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {title}{' '}
        {italicWord && <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>{italicWord}</em>}
      </h2>
      {count && (
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.15em' }}>
          {count}
        </span>
      )}
    </div>
  );
}
