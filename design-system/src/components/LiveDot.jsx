import { c } from '../tokens';

export default function LiveDot({ tone = 'accent' }) {
  const color = tone === 'alert' ? c.alert : c.accent;
  return (
    <>
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: color, animation: 'cntrd-pulse 1.6s infinite' }}
      />
      <style>{`@keyframes cntrd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </>
  );
}
