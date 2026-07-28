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
  - When emitting round-scoped events (`board:updated`, `round:activity`, `board:typing`), scope delivery to the acting entrant's own sockets (team or self) plus the host — never broadcast puzzle-answer-bearing data to the whole room, since other entrants are solving the same puzzle and would otherwise see each other's revealed letters/answers.

- **`client/`** — React 19 + TypeScript + Vite + Tailwind. One codebase serves two distinct experiences that share components but have different layout priorities: the **player view** (mobile-first — this is what's on someone's phone during a live session) and the **host view** (desktop/projector-oriented dashboard showing every entrant's board at once). `App.tsx` is a hand-rolled screen-state machine (`useState<Screen>`, no router) that switches between page components in `src/pages/` based on socket events. `ChainBoard`/`ChainRow`/`LetterCell` render the letter-grid at increasing levels of detail; `ActivityFeed` shows a live feed of hints/solves for entrants the current viewer is allowed to see.

### Key invariants worth knowing before touching round-play code

- A puzzle's word list is 0-indexed; index `0` and index `length - 1` are always the given clue rows (`isClue: true`, full text sent to every client). Everything between is a blank the active pointers gate.
- `topSolved`/`bottomSolved` only ever move to the row adjacent to them (rows aren't solved out of order), and the chain is complete once `topSolved + 1 > bottomSolved - 1`.
- Anything derived from a full `ChainState` (which contains every answer) must go through `toPublicBoardView`/`toPublicRows` before being sent to a client — never emit a raw `ChainState`.
- Team mode: teammates share one `ChainState`/board and one `entrantId`; there's no per-row locking, so simultaneous submissions are resolved first-write-wins server-side.
