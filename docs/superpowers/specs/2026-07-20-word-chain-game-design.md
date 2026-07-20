# Word Chain — Game Design

**Status:** Approved for planning
**Date:** 2026-07-20

## Overview

A real-time, multi-device party/classroom word game inspired by Kahoot's flow, built around "word chain" puzzles: a vertical list of words where the top and bottom words are given, and the words in between form a chain of compound-word/phrase connections (e.g. HOT → DOG → TAG → ALONG → SIDE → KICK). One host runs a shared session; players join from their own phones/laptops via a room code. Supports individual play and team play. Target scale: small groups (the primary use case is ~8 players/team members; the architecture assumes dozens, not hundreds, of concurrent players).

## Tech Stack & Architecture

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, Framer Motion for tile-flip/reveal animations. Single codebase containing two client experiences: **Player view** (mobile-first) and **Host view** (desktop/projector-oriented dashboard).
- **Backend:** Node.js + Socket.IO for real-time sync. Game rooms are held entirely in server memory (no database) — a room is created when a host starts a session and discarded when the session ends.
- **Icons:** Phosphor Icons (`@phosphor-icons/react`), fill/duotone weight, to match the vibrant/playful visual style.
- **Hosting:** Frontend deployed as a static build on Vercel. Backend deployed on a provider that keeps a persistent Node process alive for WebSockets (Render or Fly.io) — not a pure serverless function host.
- **Joining:** Host creates a room and gets a short room code (e.g. `BLUE-42`) plus a QR code. Players open a join URL, enter the code and a nickname (and pick a team, in Team mode). No accounts anywhere — everything is ephemeral per session.
- **Host-only control channel:** Actions that mutate game state (start round, force-advance, kick player) are only accepted from the socket connection that created the room (the host). Player sockets cannot trigger these events even if they guess the event name.
- **Presence & reconnect:** Each connected socket is tracked as online/reconnecting/disconnected. If a player's connection drops mid-round, the host sees them marked "reconnecting…" rather than removed; the player can rejoin the same room and resume their in-progress board if they reload within a grace window (e.g. 60s).
- **Custom puzzle persistence:** Puzzles created via the host's custom puzzle creator are saved to that browser's local storage — they persist across sessions on the same device but do not sync across devices (consistent with the no-accounts design).

## Puzzle Data Model

A puzzle is an ordered list of words (a "chain") plus metadata:

```
{
  id, category, difficulty,
  words: ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"],
  timeCapSeconds: 90
}
```

- `words[0]` and `words[last]` are the given clues (shown "locked").
- All words in between are blanks the player(s) must solve.
- Adjacent words must form a valid compound word or common two-word phrase (e.g. "hot dog", "dog tag").
- The app ships with a curated library of puzzles across difficulty levels/categories, and includes a custom creator so hosts can author their own. The creator only validates structure (at least 3 words, no empty/duplicate-consecutive entries, letters only) — it does not attempt to verify that adjacent words form a real compound word/phrase, since that can't be checked reliably without a curated dictionary of compounds. The host is trusted to author valid chains.

## Core Game Mechanics

**Board state:** Each puzzle has N rows (0-indexed). Row 0 and row N-1 start solved (they're the given clues). Two pointers track progress per player/team:
- `topSolved` — last solved index counting from the top (starts at 0)
- `bottomSolved` — last solved index counting from the bottom (starts at N-1)

The **active rows** are `topSolved + 1` and `bottomSolved - 1`. Only active rows accept input or hints; rows further from either solved boundary are inert/greyed out. When both pointers converge on the same row (odd-length remaining gap), only that single row is active and can be solved from either direction. The chain is complete when `topSolved + 1 > bottomSolved - 1`.

**Timing:** A synchronized stopwatch starts the instant the round begins for all players. A player/team's raw time stops the moment their chain is fully solved.

**Penalties** (added directly to raw time, and visible to the player as they occur):
- Wrong guess submitted on an active row: **+3s**
- Hint used on an active row (reveals the row's next unrevealed letter): **+5s**

**Time cap / DNF:** The host sets a round time cap (default scaled to puzzle length, e.g. ~90s for a 6-row chain, configurable per puzzle). Anyone still solving when the cap hits is scored as a non-finisher, ranked below all finishers, ordered among themselves by rows solved (most solved wins the tiebreak).

## Scoring & Leaderboard

Per-round raw time (with penalties) converts to points so the leaderboard reads like Kahoot — cumulative, satisfying, comparable across puzzles of different lengths:

- **Finishers:** `points = round(1000 × fastestTime / yourTime)`, clamped to a 300–1000 range. The fastest finisher gets 1000; others scale down smoothly by how close they were.
- **Non-finishers:** `points = round(200 × rowsSolved / totalRows)` — always below the finisher floor of 300, rewarding partial progress instead of zero.
- **Team mode** uses the identical formula against the team's shared completion time.
- Points accumulate across every puzzle in the host's playlist into a running total; the final results screen shows overall standings.

## Team Mode

- Players self-select a team from a list (defined by the host at setup) when they join.
- All teammates see the same live board on their own devices. Any teammate can attempt any currently-active row — there's no locking, but if a teammate has text entered in a row, others see a small "✏️ Jamie is typing…" indicator on that row.
- If two teammates submit valid answers for the same row near-simultaneously, the server accepts whichever arrives first; the other gets a brief "Already solved" flash instead of an error.

## Host View

- **Setup:** create a room, choose Individual or Team mode (define team names/count if Team), build a playlist from the puzzle library and/or custom creator, review/adjust time caps.
- **Lobby:** large room code + QR code, live list of joined players/teams, a subtle looping ambient/background track, and the ability to click a player's name to kick them.
- **Round active:** a grid of live mini-boards (one per player/team) updating in near real time (individual letter submissions sync within a couple hundred ms, not just at row completion), plus a running leaderboard and the elapsed timer.
- **Round results:** Kahoot-style podium/leaderboard reveal with rank movement and points earned, displayed for a fixed pause (~5-8s) before auto-advancing to the next round — the host can override/pause if they want to talk between rounds.
- **Final results:** podium celebration for top finishers plus full standings, then "Play Again" or "End Session."

## Player View & Flow

1. **Join** — room code (or QR scan) + nickname; pick a team if Team mode.
2. **Lobby** — "You're in!" waiting screen, sees who else has joined.
3. **Countdown** — synced 3-2-1 before a round begins; puzzle category is shown but not the words.
4. **Round active** — the letter-box chain board: rows left-aligned, one cell per letter (revealing word length), clue rows (top/bottom) shown in a dark "locked" cell style for visual consistency with solved (green) and in-progress (yellow/dashed) rows. Only the two currently-active rows show an inline 💡 hint button on the right (tooltip: "Reveal the next letter of this word · costs 5s added to your time"). Tapping a row brings up the keyboard; typing fills left to right; a solved row flips green with a brief animation and the active pointer(s) advance.
5. **Finished / time's up** — "Solved!" or "Time's up" state showing time + penalty breakdown, then a waiting screen for other players.
6. **Round results** — points earned this round, new rank, running total.
7. **Final results** — final placement, confetti if podium.

Light sound effects (toggleable) and playful micro-copy on fast finishes (e.g. "🔥 Blazing!") reinforce the fun, game-show tone throughout.

## Visual Design System

**Style direction:** Vibrant & Playful (chosen over Sleek Dark/Neon, Minimal/Clean, and Retro Arcade during mockup review).

- **Background:** purple-to-pink gradient (`#6C5CE7` → `#FF6B9D`)
- **Primary accent (buttons, active hint highlight):** yellow `#FFD93D` with a darker `#e0b800` drop-shadow edge for a chunky "pressable" look
- **Success/solved state:** green `#4CD964`
- **Locked/clue cells:** dark `#2d2d3a` with white text
- **In-progress cell:** white/near-white with dashed purple (`#6C5CE7`) border
- **Shape language:** rounded corners, bold offset drop-shadows (chunky, tactile), generous touch targets for mobile
- **Typography:** a bold, rounded sans-serif (e.g. Fredoka or Baloo 2) for headings/scores; a clean sans (e.g. Inter) for body/UI text
- **Icons:** Phosphor Icons, fill/duotone weight

All letter-grid rows (clue, in-progress, and solved) share the same cell size/spacing so the whole chain reads as one consistent grid, only differing by fill color/state.

## Out of Scope (for this design)

- Accounts/login and cross-device puzzle sync
- Scaling beyond dozens of concurrent players (would require a Redis-backed pub/sub layer)
- Fuzzy/typo-tolerant answer matching (exact match, case-insensitive, is the initial approach)
- Multiple-choice answer mode (typed answers only)
