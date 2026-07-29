# Word Chain PWA (installable mobile app) — Design

**Date:** 2026-07-29

## Goal

Make the existing `client` app (one React SPA covering host, player, and solo screens) installable as a Progressive Web App — "Add to Home Screen" on a phone, standalone window on desktop — without changing any gameplay logic.

## Scope

The whole app becomes the installable PWA (not just the player view), since it's already a single SPA with a shared shell (`App.tsx`'s screen-state machine).

Out of scope: full offline gameplay. The game requires a live Socket.IO connection; there is no meaningful offline mode for actually playing. This is app-shell caching for fast repeat loads plus installability, not an offline-first rework.

## Approach: `vite-plugin-pwa`

Use `vite-plugin-pwa` (Workbox-based) rather than hand-writing a manifest and service worker. It generates the web app manifest, builds the service worker, and injects the registration script into the Vite build — standard tooling for a Vite app, minimal custom code to maintain.

Icon assets are generated with `@vite-pwa/assets-generator`, a companion CLI that rasterizes one source SVG into every required manifest/icon size (192×192, 512×512, maskable variant, iOS `apple-touch-icon`). This machine has no ImageMagick/rsvg-convert available, so hand-producing PNGs isn't practical; the assets-generator handles rasterization via its own bundled dependency. Icons are placeholders — a simple mark using the existing brand palette — swappable later with real artwork.

## Manifest configuration

- `name`: "Word Chain", `short_name`: "Word Chain"
- `theme_color`: `#6C5CE7` (existing brand purple from the visual palette)
- `background_color`: `#6C5CE7`
- `display`: `"standalone"`
- `start_url`: `"/"`, `scope`: `"/"`
- `orientation`: unset (`any`) — the host dashboard is desktop/projector-oriented and must not be locked to portrait
- Icons: 192×192 PNG, 512×512 PNG, 512×512 maskable PNG, plus an `apple-touch-icon` PNG for iOS home-screen support

## Service worker / caching strategy

- `registerType: "autoUpdate"` — Workbox self-updates the service worker in the background with no user-facing "update available" prompt. This keeps the implementation simple, and a background SW swap doesn't disrupt an in-progress game: already-loaded page JS keeps running unaffected; only the *next* full load picks up fresh assets.
- `workbox.globPatterns` scoped to built JS/CSS/fonts/icons only (the Vite build output's static assets) — no runtime caching rules for XHR/WebSocket traffic. Socket.IO and any API calls always hit the network live; this is app-shell caching for fast loads, not a cache-the-game-state feature.

## Files touched

- `client/package.json` — add `vite-plugin-pwa` (dependency) and `@vite-pwa/assets-generator` (devDependency, used once via a manual script run, not part of the routine build)
- `client/vite.config.ts` — add the `VitePWA(...)` plugin block with the manifest/workbox config above
- `client/pwa-assets.config.ts` — config file for the assets-generator run (source icon path, output sizes/targets)
- New source icon artwork (`client/public/pwa-icon.svg`) — a simple placeholder mark in the brand palette; lives under `public/` (not `src/assets/`) so the generator's own next-to-source output convention writes icons directly into `public/` with no manual relocation
- Generated icon PNGs under `client/public/` (committed after a one-time generator run, not regenerated on every build)
- `client/index.html` — the plugin auto-injects the manifest link tag and SW registration script; a `theme-color` meta tag and `favicon.ico`/`apple-touch-icon` links are added manually, since those aren't covered by the plugin's auto-injection

## Testing / verification

- `npm run build --workspace=client` succeeds and emits `manifest.webmanifest` + a service worker file in `client/dist/`
- `npm run preview --workspace=client`, then inspect via Chrome DevTools MCP: Application panel shows a valid manifest (icons resolve, correct theme color) and an active service worker registration
- Run a Lighthouse pass (installability category) against the preview build
- Manual smoke test: join a room as a player and confirm normal socket gameplay still works unaffected (no regression from the SW/manifest addition)

## Non-goals

- No offline gameplay or cached game state
- No push notifications
- No changes to existing gameplay code, socket handlers, or shared package
