// Minimal ambient typing for the Vite env values this app actually reads
// (api/client.ts's VITE_API_BASE_URL, router.tsx's built-in BASE_URL) —
// scoped narrowly rather than pulling in the full `vite/client`
// triple-slash reference, same "declare just what's actually used"
// pattern as portal/assets.d.ts.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Vite always injects this — the --base build option, '/' in dev. */
  readonly BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
