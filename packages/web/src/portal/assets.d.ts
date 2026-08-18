// Ambient module declaration for static image imports (e.g. the AEGIS logo
// used in the redesigned student portal topbar) — the project doesn't
// otherwise reference Vite's `vite/client` triple-slash types, so this is
// scoped to just what's actually imported.
declare module '*.png' {
  const src: string;
  export default src;
}
