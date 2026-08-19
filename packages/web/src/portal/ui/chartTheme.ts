// AI Features Blueprint §4.2 — reads the CURRENT resolved --su-* custom
// property values from the DOM at render time (re-run on theme toggle),
// rather than hardcoding hex values that would silently go stale the next
// time student-theme.css's light/dark blocks are retuned. Recharts takes
// literal color values via props (fill/stroke/etc.), not a CSS var()
// reference reliably in every context, so this is the bridge between the
// two — every Recharts-based chart in the app should pull its colors from
// here instead of hardcoding its own.
import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';

export interface ChartTokens {
  good: string;
  goodSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  surface: string;
  surface2: string;
}

export function useChartTokens(): ChartTokens {
  const { theme } = useTheme();
  return useMemo(() => {
    // The --su-* custom properties are scoped to the `.su` app-shell class
    // (student-theme.css), NOT :root/documentElement — every layout in the
    // app renders one, so this is always present once mounted. Reading
    // from documentElement instead (an earlier version of this hook did)
    // silently returned empty strings for every token, since custom
    // properties don't resolve upward past where they're actually defined.
    const root = document.querySelector('.su') ?? document.documentElement;
    const style = getComputedStyle(root);
    const v = (name: string) => style.getPropertyValue(name).trim();
    return {
      good: v('--su-good'),
      goodSoft: v('--su-good-soft'),
      warn: v('--su-warn'),
      warnSoft: v('--su-warn-soft'),
      danger: v('--su-danger'),
      dangerSoft: v('--su-danger-soft'),
      info: v('--su-info'),
      text: v('--su-text'),
      textMuted: v('--su-text-muted'),
      textFaint: v('--su-text-faint'),
      border: v('--su-border'),
      surface: v('--su-surface'),
      surface2: v('--su-surface-2'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

/** 3-stop manual interpolation (good -> warn -> danger) by a 0-1 fraction —
 *  Recharts doesn't ship a color-scale utility, and pulling in a whole
 *  color-interpolation library for one gradient isn't worth a new
 *  dependency. Linear in each RGB channel, which is good enough for a
 *  heatmap cell fill (not used for anything requiring perceptual
 *  uniformity). */
export function interpolateSeverity(fraction: number, tokens: ChartTokens): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const [from, to, localT] =
    clamped <= 0.5 ? [tokens.goodSoft, tokens.warnSoft, clamped / 0.5] : [tokens.warnSoft, tokens.dangerSoft, (clamped - 0.5) / 0.5];
  return mixHex(from, to, localT);
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${mix(pa[0], pb[0])}, ${mix(pa[1], pb[1])}, ${mix(pa[2], pb[2])})`;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
