import { Link } from 'react-router-dom';
import { c, fonts } from '../tokens';
import { Eyebrow } from '../components';

export default function ComingSoon({ title, italicWord, blurb, legacyPath }) {
  return (
    <div style={{ paddingTop: 24 }}>
      <Eyebrow>Roadmap</Eyebrow>
      <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(38px, 7vw, 64px)', fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 20 }}>
        {title} <em style={{ fontStyle: 'italic', color: c.accent, fontWeight: 300 }}>{italicWord}</em>
      </h1>
      <p style={{ fontFamily: fonts.body, fontSize: 17, color: c.inkSoft, lineHeight: 1.55, maxWidth: 580, marginBottom: 28 }}>
        {blurb}
      </p>
      {legacyPath && (
        <a
          href={legacyPath}
          style={{
            display: 'inline-block', padding: '12px 18px', border: `1px solid ${c.accent}`,
            color: c.accent, fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}
        >
          USE LEGACY APP →
        </a>
      )}
      <div className="mt-8" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.1em' }}>
        <Link to="/feed" style={{ color: c.inkDim }}>← BACK TO FEED</Link>
      </div>
    </div>
  );
}
