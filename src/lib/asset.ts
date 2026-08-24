/**
 * URL for a file in `public/`.
 *
 * Everything here is referenced by URL rather than imported, so Vite can't rewrite these paths at
 * build time — an absolute `/sf/…` is only correct when the app is served from the root of a domain.
 * GitHub Pages serves a project under `/<repo>/`, so the base it was built with has to be prepended
 * by hand. Pass the path without a leading slash.
 */
export const asset = (path: string) => import.meta.env.BASE_URL + path
