# Word Chain PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `client` app installable as a Progressive Web App (manifest + service worker with app-shell caching), covering the whole app (host, player, solo screens), with no changes to gameplay logic.

**Architecture:** Add `vite-plugin-pwa` to the client's Vite config to generate a web app manifest and a Workbox-based service worker at build time. Generate placeholder icon assets from one new source SVG using `@vite-pwa/assets-generator`. No runtime caching for network/socket traffic — service worker precaches only the built JS/CSS/icon assets.

**Tech Stack:** Vite 8, React 19, `vite-plugin-pwa` (Workbox `generateSW` strategy), `@vite-pwa/assets-generator` (icon generation CLI, dev-time only).

## Global Constraints

- Whole app is the installable PWA scope (not just the player view) — per `docs/superpowers/specs/2026-07-29-word-chain-pwa-design.md`.
- `theme_color` / `background_color`: `#6C5CE7` (existing brand purple).
- `display: "standalone"`, `start_url: "/"`, `scope: "/"`, orientation left unset (`any`).
- `registerType: "autoUpdate"` — no user-facing update prompt.
- Service worker precaches built JS/CSS/icons only — no runtime caching rules for XHR/WebSocket (Socket.IO) traffic. Gameplay always hits the network live.
- No offline gameplay, no push notifications, no changes to gameplay/socket code or the `shared` package.
- Icons are placeholders (new simple SVG mark in the brand palette), not final artwork.

---

## File Structure

- `client/src/assets/pwa-icon.svg` — new square source icon artwork (simple chain-link glyph, brand palette), used only as generator input.
- `client/pwa-assets.config.ts` — new config for `@vite-pwa/assets-generator`, pointing at the source icon and picking the icon-size preset.
- `client/package.json` — add `vite-plugin-pwa` (dependency), `@vite-pwa/assets-generator` (devDependency), and a `generate-pwa-assets` script.
- `client/public/*.png`, `client/public/favicon.ico` — generated icon files (committed after a one-time generator run).
- `client/vite.config.ts` — add the `VitePWA(...)` plugin block (manifest + workbox config).
- `client/index.html` — add the favicon/apple-touch-icon `<link>` tags and a `theme-color` `<meta>` tag the generator recommends; no other changes (manifest link + SW registration are auto-injected by the plugin).

---

## Task 1: Add the placeholder source icon

**Files:**
- Create: `client/src/assets/pwa-icon.svg`

**Interfaces:**
- Consumes: nothing
- Produces: a square (512×512 viewBox) SVG file consumed by Task 2's `pwa-assets.config.ts` as the rasterization source.

- [ ] **Step 1: Create the source icon SVG**

Create `client/src/assets/pwa-icon.svg`. This is a simple two-link chain glyph on a solid brand-purple background — square and filter-free so it rasterizes cleanly (the existing `client/public/favicon.svg` uses Gaussian-blur filters and a non-square viewBox, which risks inconsistent rendering when rasterized by the assets generator's SVG renderer):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#6C5CE7"/>
  <g fill="none" stroke="#FFD93D" stroke-width="48" stroke-linecap="round">
    <rect x="88" y="152" width="200" height="128" rx="64"/>
    <rect x="224" y="232" width="200" height="128" rx="64"/>
  </g>
</svg>
```

- [ ] **Step 2: Verify the file is valid SVG**

Run: `node -e "const fs=require('fs'); const s=fs.readFileSync('client/src/assets/pwa-icon.svg','utf8'); if(!s.includes('<svg')) throw new Error('not svg'); console.log('OK, length', s.length)"`
Expected: `OK, length <some number>` with no error.

- [ ] **Step 3: Commit**

```bash
git add client/src/assets/pwa-icon.svg
git commit -m "Add placeholder PWA source icon"
```

---

## Task 2: Install PWA tooling and generate icon assets

**Files:**
- Modify: `client/package.json`
- Create: `client/pwa-assets.config.ts`
- Create (generated): `client/public/favicon.ico`, `client/public/pwa-64x64.png`, `client/public/pwa-192x192.png`, `client/public/pwa-512x512.png`, `client/public/maskable-icon-512x512.png`, `client/public/apple-touch-icon-180x180.png`

**Interfaces:**
- Consumes: `client/src/assets/pwa-icon.svg` (Task 1)
- Produces: the icon files above, consumed by Task 3's manifest `icons` array and `index.html` link tags. Also produces the `vite-plugin-pwa` and `@vite-pwa/assets-generator` npm packages consumed by Tasks 2-3.

- [ ] **Step 1: Install the two packages**

Run (from repo root):
```bash
npm install --workspace=client vite-plugin-pwa
npm install --workspace=client -D @vite-pwa/assets-generator
```
Expected: both commands complete with no errors; `client/package.json` now lists `vite-plugin-pwa` under `dependencies` and `@vite-pwa/assets-generator` under `devDependencies`.

- [ ] **Step 2: Add the assets-generator config**

Create `client/pwa-assets.config.ts`:

```ts
import { defineConfig, minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset,
  images: ["src/assets/pwa-icon.svg"],
});
```

- [ ] **Step 3: Add the generator script to client/package.json**

Modify `client/package.json` — add this entry to the `scripts` object (alongside `dev`, `build`, etc.):

```json
"generate-pwa-assets": "pwa-assets-generator"
```

- [ ] **Step 4: Run the generator**

Run: `npm run generate-pwa-assets --workspace=client`
Expected: output listing generated files (`favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`) written into `client/public/`, plus a block of suggested `<link>` head tags printed to the console. Copy that printed link-tag block somewhere handy — Task 3 Step 3 needs the `favicon.ico` and `apple-touch-icon` lines from it.

- [ ] **Step 5: Verify the generated files exist**

Run: `node -e "const fs=require('fs'); ['favicon.ico','pwa-64x64.png','pwa-192x192.png','pwa-512x512.png','maskable-icon-512x512.png','apple-touch-icon-180x180.png'].forEach(f => { if(!fs.existsSync('client/public/'+f)) throw new Error('missing '+f); }); console.log('all icons present')"`
Expected: `all icons present`

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/pwa-assets.config.ts client/public/favicon.ico client/public/pwa-64x64.png client/public/pwa-192x192.png client/public/pwa-512x512.png client/public/maskable-icon-512x512.png client/public/apple-touch-icon-180x180.png
git commit -m "Add vite-plugin-pwa/assets-generator deps and generate placeholder icons"
```

Note: if the repo's root `package-lock.json` is what actually changes (npm workspaces hoist to the root lockfile), stage that path instead of `client/package-lock.json` — check `git status` for which lockfile path was modified before committing.

---

## Task 3: Wire the VitePWA plugin into the build

**Files:**
- Modify: `client/vite.config.ts`
- Modify: `client/index.html`

**Interfaces:**
- Consumes: `vite-plugin-pwa`'s `VitePWA` export (Task 2), the generated icon filenames (Task 2)
- Produces: a `manifest.webmanifest` and service worker emitted at build time, consumed by Task 4's build verification and Task 5's runtime verification.

- [ ] **Step 1: Add the VitePWA plugin to vite.config.ts**

Modify `client/vite.config.ts` — replace its full contents with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Word Chain',
        short_name: 'Word Chain',
        theme_color: '#6C5CE7',
        background_color: '#6C5CE7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
})
```

- [ ] **Step 2: Add the theme-color meta tag to index.html**

Modify `client/index.html` — add this line inside `<head>`, right after the existing `<link rel="icon" ...>` line:

```html
    <meta name="theme-color" content="#6C5CE7" />
```

- [ ] **Step 3: Add the favicon.ico and apple-touch-icon links from the generator output**

Modify `client/index.html` — add these two lines inside `<head>`, right after the `theme-color` meta tag added in Step 2 (these mirror the `favicon.ico` and `apple-touch-icon` lines the Task 2 Step 4 generator output printed; the manifest link itself is injected automatically by the plugin, so it is not added here):

```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 4: Commit**

```bash
git add client/vite.config.ts client/index.html
git commit -m "Wire VitePWA plugin with manifest and app-shell-only caching"
```

---

## Task 4: Verify the production build emits PWA artifacts

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: the build produced by Task 3's config
- Produces: confidence the manifest/service worker are correctly emitted, consumed as a gate before Task 5.

- [ ] **Step 1: Run the client build**

Run: `npm run build --workspace=client`
Expected: build completes with no errors; output mentions `manifest.webmanifest` and a service worker file (`sw.js`) being generated (vite-plugin-pwa logs a `PWA v<version>` summary block near the end of build output).

- [ ] **Step 2: Verify manifest.webmanifest was emitted with expected fields**

Run: `node -e "const m=require('./client/dist/manifest.webmanifest'); if(m.name!=='Word Chain') throw new Error('bad name'); if(m.theme_color!=='#6C5CE7') throw new Error('bad theme_color'); if(m.icons.length<4) throw new Error('missing icons'); console.log('manifest OK:', JSON.stringify({name:m.name, theme_color:m.theme_color, icons:m.icons.length}))"`
Expected: `manifest OK: {"name":"Word Chain","theme_color":"#6C5CE7","icons":4}`

- [ ] **Step 3: Verify the service worker file exists**

Run: `node -e "const fs=require('fs'); if(!fs.existsSync('client/dist/sw.js')) throw new Error('sw.js missing'); console.log('sw.js present')"`
Expected: `sw.js present`

- [ ] **Step 4: Verify existing client tests still pass**

Run: `npm run test --workspace=client`
Expected: PASS — same test count/result as before this plan's changes (the plugin only affects the build, not the Vitest/jsdom test environment).

No commit for this task — it's verification only, nothing changed.

---

## Task 5: Verify installability and manifest correctness in-browser

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: the built `client/dist` output from Task 4
- Produces: confirmation the PWA is installable, closing out the plan.

- [ ] **Step 1: Start the preview server**

Run: `npm run preview --workspace=client` (leave running; note the printed local URL, typically `http://localhost:4173`)

- [ ] **Step 2: Open the preview URL in Chrome DevTools MCP and inspect the manifest**

Use the Chrome DevTools MCP tools: `new_page` with the preview URL, then `list_console_messages` to confirm no errors, then `evaluate_script` with `() => navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => r.active?.scriptURL))` to confirm a service worker registered.
Expected: console has no errors related to the manifest or service worker; the evaluate call returns an array containing a URL ending in `/sw.js`.

- [ ] **Step 3: Run a Lighthouse installability check**

Use the Chrome DevTools MCP `lighthouse_audit` tool (`mode: "navigation"`, default desktop device is fine) against the preview page.
Expected: the report's installability-related audits pass (manifest has a valid `start_url`, icons, and `short_name`/`name`; a service worker is registered).

- [ ] **Step 4: Stop the preview server**

Stop the background preview process started in Step 1.

- [ ] **Step 5: Manual regression smoke test**

Run `npm run dev:server` and `npm run dev:client` (separately, both left running). Open the client dev URL in Chrome DevTools MCP, create a host room (`host:createRoom` flow via the UI), and join it from a second tab as a player, confirming the existing join/lobby flow still works with no new console errors. Stop both dev processes afterward.
Expected: room creation and join succeed exactly as before this plan's changes — no regression from adding the PWA plugin.

No commit for this task — it's verification only, nothing changed.

---

## Self-Review Notes

- **Spec coverage:** whole-app scope (Task 3 manifest `scope`/`start_url`), theme/background colors (Task 3), `standalone` display + unset orientation (Task 3), `autoUpdate` registerType (Task 3), app-shell-only `globPatterns` with no runtime caching rules (Task 3), placeholder icon generation via `@vite-pwa/assets-generator` (Tasks 1-2), build/runtime/Lighthouse verification (Tasks 4-5), regression smoke test (Task 5) — every design section maps to a task.
- **Placeholder scan:** no TBD/TODO markers; every step has literal file contents or exact commands with expected output.
- **Type/name consistency:** icon filenames introduced in Task 2 (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`) are the exact names referenced in Task 3's manifest `icons` array, `includeAssets`, and `index.html` links.
