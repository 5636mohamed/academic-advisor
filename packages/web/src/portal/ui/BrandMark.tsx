// AEGIS rebrand — a single theme-aware logo component used everywhere the
// app shows its brand mark (all 4 layout topbars + the login page), instead
// of duplicating a light/dark ternary at each call site. Both source PNGs
// (public assets, from the user-supplied Logo-dark-mode.png/Logo-white-
// mode.png) are transparent cutouts, unlike the old, since-replaced logo which
// was its own opaque, theme-agnostic red circle — so which variant to show
// now genuinely depends on what's behind it: the app's light theme paints
// light/white surfaces (`--su-surface: #fff`), so the BLACK-lined
// "Logo-white-mode" export reads correctly there; dark theme paints dark
// surfaces, so the WHITE/light-lined "Logo-dark-mode" export reads
// correctly there. (Confusingly, the source filenames name which
// BACKGROUND each is *for*, not the theme it's used *in* — dark theme uses
// the "dark-mode" file, light theme uses the "white-mode" file; the naming
// lines up, it's just easy to misread at a glance.)
import { CSSProperties } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import aegisIconDark from '../../assets/aegis-icon-dark.png';
import aegisIconLight from '../../assets/aegis-icon-light.png';
import aegisFullDark from '../../assets/aegis-full-dark.png';
import aegisFullLight from '../../assets/aegis-full-light.png';

export interface BrandMarkProps {
  /** 'icon' = shield + horse-head only (topbars, favicon-sized contexts).
   *  'full' = icon + "AEGIS / Academic Advisor System" wordmark lockup
   *  (the login page's big display). */
  variant?: 'icon' | 'full';
  /** Overrides which variant to pick instead of following the app's own
   *  light/dark toggle — for a placement whose OWN background is fixed
   *  regardless of the app theme, e.g. the login page's always-dark brand
   *  panel (built from the existing `--su-banner-bg` dark surface token,
   *  not from `--su-surface`, so it doesn't flip with the toggle either). */
  forceTheme?: 'light' | 'dark';
  className?: string;
  style?: CSSProperties;
}

export function BrandMark({ variant = 'icon', forceTheme, className, style }: BrandMarkProps) {
  const { theme } = useTheme();
  const effectiveTheme = forceTheme ?? theme;
  const src = variant === 'icon'
    ? (effectiveTheme === 'dark' ? aegisIconDark : aegisIconLight)
    : (effectiveTheme === 'dark' ? aegisFullDark : aegisFullLight);
  return <img src={src} alt="AEGIS — Academic Advisor System" className={className} style={style} />;
}
