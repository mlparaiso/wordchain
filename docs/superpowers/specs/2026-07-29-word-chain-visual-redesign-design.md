# Word Chain Visual Redesign — Design

**Date:** 2026-07-29

## Goal

The current UI is functionally solid but visually reads as a wireframe: flat gradient background, flat solid-color tiles with no depth, ad-hoc per-page button styling repeated across 7+ files, a barely-visible chain-link connector icon (despite "chain" being the game's namesake), and no real celebratory payoff moment. This redesign gives the existing brand palette and component structure actual visual weight and personality — without touching game logic, socket handlers, or the `shared` package.

## Research basis

Live comparison against three references (screenshotted directly, not from memory):
- **Kahoot** (kahoot.com) — bold saturated state colors, confident mixed-weight headline typography, and a proper podium/leaderboard payoff screen.
- **CrazyGames** (crazygames.com/t/casual, /t/word) — chunky outlined/drop-shadowed lettering, tile-style letters that read as physical objects, badge treatments.
- **Pogo** (pogo.com, Word Whomp HD) — glossy beveled 3D buttons (gradient fill, gloss highlight, thick outline, drop shadow), mascot/illustration accents, social-proof text ("242 playing now").

Our own screenshots of the landing screen and the live `ChainBoard` (via Solo Practice) confirmed the gap directly: flat fills with zero bevel/shadow except the `hinted` state, a board hugging the top-left corner of an otherwise empty viewport, and plain-text timer/controls.

## Direction: "Chunky Chain"

Tactile, high-contrast, playful — built by adding *depth and a real chain motif* to the existing palette (`#6C5CE7` purple, `#FF6B9D` pink, `#FFD93D` yellow, `#4CD964` green, `#2d2d3a` locked-navy), not by replacing it. The palette is fine; the flatness of its application is the problem.

Two threads run through every change below:
1. **Tactile depth** — every interactive surface (tile, button, panel) gets a bevel: an inset top highlight + a solid offset bottom shadow, in the Pogo/CrazyGames style, using the same layered-`box-shadow` approach the codebase already uses for `hinted` cells (`shadow-[0_3px_0_#e0b800]`) — extended to every state and every button, not just one.
2. **The chain is the mascot** — since there's no illustrated character to carry personality (unlike Kahoot/Pogo), the literal chain-link motif becomes the game's visual signature: an actual interlocking-rings connector graphic between rows (replacing the near-invisible current link icon), reused as a decorative motif on the landing screen and loading states.

## Component-by-component changes

**`LetterCell`** (`client/src/components/LetterCell.tsx`) — every state gets a bevel via layered box-shadow (inset lighter top edge + solid darker bottom offset), not just `hinted`. `locked` gets an inset/recessed shadow (reads as "closed," consistent with it being unrevealed). `solved` gets a brief scale/pulse on transition into that state (CSS animation, no new dependency). `typing` keeps the dashed active-outline concept but adds a glow ring in `chain-purple`. Colors and letters-only content are unchanged — this is a treatment change, not a new state or a palette change.

**Chain-link connectors** (between `ChainRow`s, currently a tiny SVG/icon) — replaced with a small horizontal interlocking-rings graphic sized to be clearly visible (not decorative-only — same accessibility semantics as today), recolored gray when the rows on either side aren't both solved, and yellow/purple when the chain between them is complete. This directly reinforces the "chain" in Word Chain.

**Buttons** — introduce one shared `Button` component (`client/src/components/Button.tsx`) with `primary` (yellow, glossy bevel — the Pogo "PLAY button" treatment), `secondary` (white/outline), and `ghost` (text-link, e.g. "Practice Solo") variants, plus a small press animation (`translateY` + shadow-compress on `:active`). This replaces the ad-hoc `bg-chain-yellow ...` button markup currently duplicated across `JoinPage`, `HostSetupPage`, `HostLobbyPage`, `PlayerLobbyPage`, `ResultsPage`, `SoloResultsPage`, and `CustomPuzzleCreatorPage` — a real duplication cleanup, not scope creep, since consistent bevel/press treatment is the whole point of this pass.

**Icon controls** (hint lightbulb, mute button, kick-player, etc.) — a small `IconButton` component (circular, bordered, same bevel language as `Button`) replacing today's one-off `rounded-full bg-white/25 border-2 ...` markup.

**Timer** — replaced from plain text ("8s") with a compact pill/badge (clock glyph + number) that shifts through the existing penalty/success color language as time runs low (green → yellow → red), reusing colors already defined in the palette rather than introducing new ones.

**Landing screen** (`App.tsx` root / a `LandingPage`) — background gets a subtle decorative chain-link pattern (CSS/SVG, no image asset, so no load-time cost) instead of a bare gradient, and the hero area gets a small static chain-link graphic next to the title so the screen doesn't read as an empty form. Buttons switch to the new `Button` component.

**Results screens** (`ResultsPage`, `FinalResultsPage`, `SoloResultsPage`) — build a real podium moment for the top 3 (gold/silver/bronze accent treatment, matching Kahoot's payoff screen), keeping the existing count-up score animation and `canvas-confetti` usage already in the codebase — this pass makes that moment visually match the effort already in the scoring logic, it doesn't add new confetti/animation infrastructure.

**Host dashboard** (`HostSetupPage`, `HostLobbyPage`, `HostRoundPage`) — same `Button`/`IconButton`/tile treatment applied; entrant boards on `HostRoundPage` get a card/panel wrapper (elevated surface with the same bevel language) so each player's board reads as a distinct tile on a projector instead of floating on the flat background.

**Typography** — no font changes (Baloo 2 / Inter / Space Mono are already loaded and appropriate), but usage becomes more deliberate: Baloo 2 (already the `font-display` family) is used consistently for headings, scores, and the timer to carry the "chunky" personality; Space Mono stays reserved for the room code (already the case per the existing design plan).

## Non-goals

- No changes to game logic, `ChainState`, socket events, or the `shared` package — this is CSS/markup/component-structure only.
- No new brand colors — depth comes from shadows/gradients of the existing palette, not new hues.
- No new illustrated mascot/character — the chain-link motif is the personality carrier instead.
- No animation library addition — CSS transitions/keyframes and the existing `framer-motion`/`canvas-confetti` dependencies cover everything here.
- No accessibility regression — state changes that currently convey meaning via color alone (e.g. `solved` vs `locked`) keep a non-color signal (shape/icon/motion), per the existing letters-only content already satisfying this for the core mechanic.

## Testing / verification

- Existing Vitest suites for `LetterCell`, `ChainRow`, `ChainBoard`, and every page component must keep passing — these test structure/behavior (`data-testid`, `data-state`, click handlers), not exact class strings, so a treatment-only change shouldn't break them; any test that does assert exact Tailwind classes gets updated in the same task as the component it covers.
- Visual verification via Chrome DevTools MCP screenshots: before/after comparison of the landing screen, a live `ChainBoard` (via Solo Practice, fastest path to real gameplay pixels), and a results screen.
- `npm run build --workspace=client` and `npm run test --workspace=client` must pass before this is considered done.
