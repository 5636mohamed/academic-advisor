// Small inline-SVG icon set for the student portal's redesigned UI (see
// /UI Design Student/*.pdf) — stroke-based, currentColor, no icon-library
// dependency. Kept intentionally minimal: only the glyphs the new screens
// actually use.
import { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => {
  const width = props.width ?? 18;
  const height = props.height ?? 18;
  return {
    width,
    height,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
    // The `width`/`height` SVG *attributes* alone don't reliably establish
    // CSS box sizing for an inline SVG inside a flex container (a known
    // cross-browser quirk — Chromium was measured collapsing these icons to
    // 0 width, full height, i.e. an invisible sliver, even though the
    // attributes were correctly 17/18 in the DOM). Setting them again here
    // as real CSS pixel values via `style` — merged after `...props` so an
    // explicit `style` prop from a caller still wins — makes sizing
    // unambiguous regardless of layout context.
    style: { width, height, flexShrink: 0, ...props.style },
  };
};

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="1.5" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22.5" />
    <line x1="4.2" y1="4.2" x2="5.9" y2="5.9" /><line x1="18.1" y1="18.1" x2="19.8" y2="19.8" />
    <line x1="1.5" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22.5" y2="12" />
    <line x1="4.2" y1="19.8" x2="5.9" y2="18.1" /><line x1="18.1" y1="5.9" x2="19.8" y2="4.2" />
  </svg>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" /></svg>
);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><polyline points="9 18 15 12 9 6" /></svg>
);
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
export const IconPerson = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></svg>
);
export const IconPeople = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" />
    <circle cx="17.5" cy="8.5" r="2.6" /><path d="M15.5 13.3c2.7.4 4.5 1.9 4.5 4.7" />
  </svg>
);
export const IconPaperPlane = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><polyline points="20 6 9 17 4 12" /></svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
);
export const IconTrendUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><polyline points="3 17 9 11 13 15 21 6" /><polyline points="14 6 21 6 21 13" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M7.5 7.5l2 2M14.5 14.5l2 2M16.5 7.5l-2 2M9.5 14.5l-2 2" />
  </svg>
);
export const IconFileText = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);
export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 8 12 14 22 8 12 2" /><polyline points="2 15 12 21 22 15" /><polyline points="2 11.5 12 17.5 22 11.5" />
  </svg>
);
export const IconRocket = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2" />
    <path d="M12 15a15 15 0 0 0 7-9 3.5 3.5 0 0 0-4-4 15 15 0 0 0-9 7l6 6z" />
    <circle cx="15" cy="9" r="1.6" />
  </svg>
);
