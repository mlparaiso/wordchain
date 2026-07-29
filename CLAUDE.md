# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is an npm workspaces monorepo with three packages: `shared`, `server`, `client`.

```bash
npm install                          # install once from repo root (hoists all three workspaces)

npm test                             # run all tests (shared + server + client), from repo root
npm run test --workspace=server      # run one workspace's tests
npm run test --workspace=client
npm run test --workspace=shared

npx vitest run path/to/file.test.ts  # run a single test file (run inside client/ or server/, or pass -- to the workspace script)
npx vitest run -t "test name"        # run a single test by name

npm run dev:server                   # start the Socket.IO server (tsx watch, http://localhost:3001)
npm run dev:client                   # start the Vite dev server for the client

npm run build --workspace=client     # tsc -b && vite build
npm run lint --workspace=client      # oxlint
```

There is no root-level build/lint script — run them per-workspace as above. The server has no lint script configured.

## Architecture

**Word Chain** is a real-time, multi-device party game (Kahoot-style flow): a host runs a session, players join via a room code, and everyone races to solve a "word chain" puzzle — a vertical list of words where the top and bottom words are given clues and the words in between form a chain of compound-word/phrase links (e.g. HOT → DOG → TAG → ALONG → SIDE → KICK). Full design background is in `docs/superpowers/specs/2026-07-20-word-chain-game-design.md`.

### The three packages

- **`shared/`** — framework-free TypeScript, imported by both client and server as `@wordchain/shared` (workspace source, no build step — consumers point straight at `src/`). This is where game rules live, not just types:
  - `chainSolver.ts` — the core state machine. `ChainState` tracks two pointers (`topSolved`, `bottomSolved`) that close in from both ends of the word list; `submitGuess`/`applyHint` are pure functions that advance the pointers or add time penalties. `getActiveRows`/`isComplete` derive from the pointers rather than being stored. `toPublicBoardView`/`toPublicRows` strip a `ChainState`/puzzle down to what's safe to send to a given client (never send unsolved words).
  - `scoring.ts` — converts raw completion time + penalties into leaderboard points.
  - `puzzles.ts` — the curated puzzle library (`PUZZLE_LIBRARY`), grouped by difficulty (easy = 7 words/5 blanks, medium = 9/7, hard = 11/9). Every adjacent word pair must form a real compound word or common two-word phrase.
  - `puzzleValidation.ts` — structural validation for host-authored custom puzzles (word count, no empty/duplicate-consecutive words). It does *not* verify that adjacent words form a real compound/phrase — hosts are trusted for that.

- **`server/`** — Node + Express + Socket.IO. `src/index.ts`'s `createServer()` wires an in-memory `RoomManager` to a set of `register*Handlers` modules, one per socket-event concern (`registerHostHandlers`, `registerPlayerHandlers`, `registerHostRoundHandlers`, `registerRoundPlayHandlers`, `registerPresenceHandlers`). There is no database — a `Room` (see `rooms/Room.ts`) lives entirely in memory for the lifetime of a session and is discarded when it ends. Server-authoritative state lives in `Room.currentRound.entrantChains: Map<entrantId, ChainState>`.
  - **entrantId** is the unifying concept for individual vs. team mode: in individual mode it's the player's `socketId`; in team mode it's the `teamId`, and all teammates share one `ChainState`. `Room.getEntrantId(socketId)` resolves this. Most round-play logic is written in terms of `entrantId` and doesn't otherwise branch on game mode.
  - **Host-only control channel**: state-mutating events (start round, force-advance, kick player, end session) check `socket.id === room.hostSocketId` before acting — player sockets can't trigger them even if they guess the event name.
  - **Presence & reconnect**: a dropped connection doesn't remove the player immediately; `registerPresenceHandlers` gives a grace period, and `Room.reconnectPlayer` re-associates a returning socket (matched by nickname + session token) with its old `PlayerInfo` and in-progress `ChainState`.
  - **`socket/roundEventRecipients.ts`** — `roundEventRecipients(room, entrantId)`/`emitToRoundEventRecipients(...)` compute the acting entrant's own sockets (team or self) plus the host. Every round-scoped event (`board:updated`, `round:activity`, `board:typing`) must go through this instead of `io.to(room.code)` — never broadcast puzzle-answer-bearing data to the whole room, since other entrants are solving the same puzzle and would otherwise see each other's revealed letters/answers.

- **`client/`** — React 19 + TypeScript + Vite + Tailwind. One codebase serves three experiences that share components but have different layout priorities: the **player view** (mobile-first — this is what's on someone's phone during a live session), the **host view** (desktop/projector-oriented dashboard showing every entrant's board at once), and a **solo practice mode** (`SoloDifficultyPage` → `SoloRoundPage` → `SoloResultsPage`) that runs the same `ChainState` engine entirely client-side against a random library puzzle, no server/room involved. `App.tsx` is a hand-rolled screen-state machine (`useState<Screen>`, no router) that switches between page components in `src/pages/` based on socket events. `ChainBoard`/`ChainRow`/`LetterCell`/`ChainLink` render the letter-grid and its connectors at increasing levels of detail; `ActivityFeed` shows a live feed of hints/solves for entrants the current viewer is allowed to see. `CustomPuzzleCreatorPage` lets a host author a one-off puzzle (validated by `validatePuzzleWords`, stored in `localStorage` via `customPuzzles.ts`) alongside the curated `PUZZLE_LIBRARY`.
  - **PWA**: the whole client is an installable Progressive Web App via `vite-plugin-pwa` (`client/vite.config.ts`) — manifest + a Workbox service worker generated at build time (`registerType: "autoUpdate"`). The service worker precaches only built JS/CSS/icons (`workbox.globPatterns`); it deliberately does **not** cache any network/XHR/WebSocket traffic, so Socket.IO always hits the network live — this is app-shell caching for fast repeat loads, not offline gameplay (there's no meaningful offline mode for a live multiplayer game). Icons are placeholders generated by `@vite-pwa/assets-generator` from `client/public/pwa-icon.svg` (`npm run generate-pwa-assets --workspace=client`) — the source SVG must live under `public/`, not `src/assets/`, because the generator writes output next to its source with no configurable output directory.
  - **Visual design system**: `Button` (`client/src/components/Button.tsx`, variants `primary`/`secondary`/`outline`/`ghost`, sizes `sm`/`md`) and `IconButton` (`client/src/components/IconButton.tsx`) are the canonical button primitives — every CTA and icon control in the app should use one of these rather than hand-rolled `bg-chain-yellow shadow-[...] rounded-full` markup. The brand palette (`chain-purple`/`chain-pink`/`chain-yellow`/`chain-green`/`chain-locked`, defined in `client/tailwind.config.js`) is fixed; visual "polish" work in this codebase means adding tactile depth (layered `box-shadow` bevels, e.g. `shadow-[0_3px_0_#e0b800]`) to that palette, not introducing new brand hues.

### Key invariants worth knowing before touching round-play code

- A puzzle's word list is 0-indexed; index `0` and index `length - 1` are always the given clue rows (`isClue: true`, full text sent to every client). Everything between is a blank the active pointers gate.
- `topSolved`/`bottomSolved` only ever move to the row adjacent to them (rows aren't solved out of order), and the chain is complete once `topSolved + 1 > bottomSolved - 1`.
- Anything derived from a full `ChainState` (which contains every answer) must go through `toPublicBoardView`/`toPublicRows` before being sent to a client — never emit a raw `ChainState`.
- `createChainState` does **not** start every blank fully hidden: every blank row (not the clue rows) has its first letter pre-revealed for free (`revealedLetters[i] = 1`), and this costs no time penalty. A player-triggered hint via `applyHint` reveals the *next* letter after that, still at the usual 5s cost. Don't assume `revealedLetters` starts all-zero in new code or tests.
- Team mode: teammates share one `ChainState`/board and one `entrantId`; there's no per-row locking, so simultaneous submissions are resolved first-write-wins server-side.

## Gotchas

- **Clients can't compute their own starting board.** Only the server knows the answer words, so the free first-letter reveal (above) can't be reconstructed client-side from `round:started`'s `rows` payload (which only carries clue text + blank lengths). `host:startRound` therefore pushes an immediate `board:updated` per entrant right after `room.startRound(...)` — if you add another piece of server-only-knowable starting state, it needs the same treatment, or players will only see it after their first guess/hint happens to trigger a sync.
- **Flex children don't shrink below their content by default.** `ChainBoard`'s rows live inside `flex` wrappers (e.g. `<div className="w-full max-w-md flex justify-start">`); a flex item's default `min-width: auto` means it won't shrink narrower than its longest row even if the parent is width-constrained — a chain with a long word (e.g. an 11-letter word) would silently push the *whole page* wider than the viewport on a phone instead of just that row. Fixed with `min-w-0` + `overflow-x-auto` on `ChainBoard`'s root — keep both if you touch that component's layout.
- **`validatePuzzleWords` only checks structure** (letters-only, no empty/duplicate-consecutive words, ≥3 words) — it does not check that adjacent words form a real compound/phrase, or that a new puzzle doesn't duplicate an existing one's word sequence. When adding to `PUZZLE_LIBRARY`, manually verify every adjacent pair and check for accidental overlap: a script like `node -e "..."` scanning `puzzles.ts` for repeated 3-word runs across puzzles is the fastest way (four new puzzles collided with existing ones this way in one pass — reusing a *single* compound-forming word like BALL/LINE/WORK across puzzles is fine and expected, but an identical 3+ word run reads as a copy).
- **This machine has multiple `gh` accounts logged in** (`x122182` and `mlparaiso`), and the git credential helper defers to whichever one `gh` has marked active — `git push` can fail with a 403 from the *wrong* authenticated account even though credentials are technically configured. If a push to this repo is rejected with a permissions error, check `gh auth status` and `gh auth switch --hostname github.com --user mlparaiso` before assuming it's a real access problem.
- **Testing Library's `getByText` matches an element's own concatenated text content**, so adding a decorative icon/emoji as a sibling *inside the same element* as previously-tested text breaks any `getByText("exact string")` assertion on that text (e.g. wrapping a timer's `{seconds}s` in the same `<span>` as a new `⏱️` glyph changes that span's text to `"⏱️5s"`, no longer matching `getByText("5s")`). Fix by nesting the original, unchanged element one level deeper inside a new wrapper, with the new decorative content as a *sibling* of that inner element rather than merged into it — the inner element's own text content stays exactly what it was. This bit twice in the 2026-07-29 visual redesign pass (`ResultsPage`'s rank text, the round pages' elapsed-time badge) before landing on this pattern.
- **Chrome DevTools MCP's browser instance can be left running from a prior session/crash** and holds a lock on its profile directory (`~/.cache/chrome-devtools-mcp/chrome-profile`), causing `new_page`/`list_pages` to fail with "The browser is already running for ... Use `--isolated` to run multiple browser instances." Find and kill the orphaned `chrome.exe` process tree whose command line references that profile path (safe — it's a dedicated automation profile, not the user's real browser) rather than assuming a real connection problem.
- **Lighthouse's dedicated PWA/installability audit category has been removed upstream** (as of the Lighthouse version bundled with this environment's `chrome-devtools-mcp`) — don't expect `lighthouse_audit` to report a PWA score. Verify installability directly instead: check `manifest.webmanifest`'s fields and confirm `navigator.serviceWorker.getRegistrations()` shows an active registration.
- **Known minor follow-up items from the 2026-07-29 visual redesign** (flagged by final review, not blocking, safe to pick up opportunistically): the mute/sound toggle button on `PlayerRoundPage`/`SoloRoundPage` still uses a plain emoji `<button>` instead of `IconButton`; `ResultsPage`'s non-podium leaderboard rows (rank 4+) render the rank number and name as text-content-adjacent siblings with no literal space between them (relies on flex `gap-2` visually); `#2fa350` (a hand-picked darker-green shadow shade used for "solved" bevels) isn't listed alongside the other brand colors in `client/tailwind.config.js`'s theme extension.
