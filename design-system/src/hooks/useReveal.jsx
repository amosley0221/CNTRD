import { useEffect, useRef, useState } from 'react';

// IntersectionObserver-based scroll reveal. Returns a ref to attach to
// the element and a "shown" boolean that flips true the first time the
// element enters the viewport. Components fade in + slide up with a
// short transition. Cheaper than GSAP for the simple "appear on scroll"
// motion the mockups use; no extra dependency.
export function useReveal({ rootMargin = '0px 0px -12% 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current || shown) return;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShown(true)),
      { rootMargin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown, rootMargin]);
  return [ref, shown];
}

// Reveal wrapper that handles the styling. Drop-in: <Reveal>...</Reveal>.
export function Reveal({ children, as: Tag = 'div', delay = 0, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      {...rest}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms`,
        ...(rest.style || {}),
      }}
    >
      {children}
    </Tag>
  );
}

// Animated number that counts up from 0 to `value` when it scrolls into
// view. Decimals keep one fractional digit; integers count as integers.
// Useful for the "by the numbers" rows on profile and game pages.
export function CountUp({ value, duration = 1400, decimals }) {
  const [ref, shown] = useReveal({ rootMargin: '0px 0px -8% 0px' });
  const [shown_, setShownValue] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const target = parseFloat(value);
    if (!Number.isFinite(target)) { setShownValue(value); return; }
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownValue(eased * target);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, value, duration]);
  const d = typeof decimals === 'number' ? decimals
          : Number.isInteger(parseFloat(value)) ? 0 : 1;
  const text = typeof shown_ === 'number' ? shown_.toFixed(d) : String(shown_);
  return <span ref={ref}>{text}</span>;
}
