// AEGIS rebrand — the login page's right-side panel cycles through exactly
// these 3 fixed quotes with a typewriter effect (types out, holds, deletes,
// moves to the next). All colors come from the existing `--su-*` theme
// tokens — no new colors introduced, "no exceptions" per the rebrand spec.
//
// `prefers-reduced-motion` note: the theme's existing CSS-only reduced-
// motion rule (an `animation: none` override) only ever catches CSS
// `@keyframes`-driven effects. This component's animation is a JS
// `setInterval` mutating plain text content instead, which that CSS rule
// can't see at all — so it needs its own `matchMedia` check here, and
// falls back to just showing the final quote statically when reduced
// motion is requested.
import { useEffect, useState } from 'react';

const QUOTES = [
  'Stay hungry, Stay foolish',
  'Always the one thousand journey starts with a single step',
  'Consistent slow development is better than sudden peak',
] as const;

const TYPE_MS = 45;
const DELETE_MS = 25;
const HOLD_MS = 1800;
const GAP_MS = 400;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Typewriter({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [reduced] = useState(prefersReducedMotion);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting' | 'gap'>('typing');

  useEffect(() => {
    if (reduced) return;
    const current = QUOTES[quoteIndex];

    if (phase === 'typing') {
      if (text.length < current.length) {
        const t = setTimeout(() => setText(current.slice(0, text.length + 1)), TYPE_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('holding'), HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'holding') {
      const t = setTimeout(() => setPhase('deleting'), 0);
      return () => clearTimeout(t);
    }
    if (phase === 'deleting') {
      if (text.length > 0) {
        const t = setTimeout(() => setText(current.slice(0, text.length - 1)), DELETE_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('gap'), GAP_MS);
      return () => clearTimeout(t);
    }
    // phase === 'gap'
    const t = setTimeout(() => {
      setQuoteIndex(i => (i + 1) % QUOTES.length);
      setPhase('typing');
    }, 0);
    return () => clearTimeout(t);
  }, [text, phase, quoteIndex, reduced]);

  if (reduced) {
    return (
      <div className={className} style={style}>
        <span>{QUOTES[0]}</span>
      </div>
    );
  }

  return (
    <div className={className} style={style} aria-live="polite">
      <span>{text}</span>
      <span className="su-typewriter-caret" aria-hidden="true" />
    </div>
  );
}
