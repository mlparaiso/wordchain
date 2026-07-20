# Word Chain Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time multiplayer "Word Chain" party game — host runs a shared dashboard, players join from their own devices, solve word chains inward from both ends, scored like Kahoot.

**Architecture:** npm-workspaces monorepo with three packages: `shared` (pure TypeScript logic — chain-solving, scoring, puzzle validation — used by both client and server), `server` (Node + Socket.IO real-time backend, in-memory room state), and `client` (React + Vite + Tailwind, two experiences: Host dashboard and Player board).

**Tech Stack:** TypeScript everywhere. React 18 + Vite + Tailwind CSS + Framer Motion + `@phosphor-icons/react` (client). Node.js + Express + Socket.IO 4 (server). Vitest + React Testing Library (tests, all packages).

## Global Constraints

- No accounts/login anywhere — rooms and players are ephemeral, identified only by socket connection + room code.
- Room/game state lives entirely in server memory — no database.
- Answer matching is exact, case-insensitive (trim + uppercase compare) — no fuzzy/typo tolerance.
- Answers are typed letters only — no multiple-choice mode.
- Wrong guess penalty: **+3s**. Hint penalty: **+5s**. Both add directly to a player's raw solve time.
- Finisher points: `round(1000 × fastestTime / yourTime)`, clamped to **[300, 1000]**.
- Non-finisher points: `round(200 × rowsSolved / totalRows)`.
- Visual palette (exact hex): background gradient `#6C5CE7` → `#FF6B9D`; accent yellow `#FFD93D` / shadow `#e0b800`; success green `#4CD964`; locked cell `#2d2d3a`; in-progress cell white with `#6C5CE7` dashed border.
- Only the two rows adjacent to the solved top/bottom boundary are ever interactive at once (per the two-pointer chain mechanic) — never more, never fewer than 1 when a chain is one row from done.

---

## File Structure

```
/package.json                    root, npm workspaces: shared, server, client
/tsconfig.base.json

/shared/package.json             "@wordchain/shared"
/shared/tsconfig.json
/shared/src/types.ts             Puzzle, PlayerInfo, TeamInfo, socket event payload types
/shared/src/chainSolver.ts       two-pointer solve state machine (pure)
/shared/src/scoring.ts           points formulas (pure)
/shared/src/puzzleValidation.ts  puzzle word-list structural validation (pure)
/shared/src/puzzles.ts           curated puzzle library data (shared by server + client)
/shared/tests/*.test.ts

/server/package.json             "@wordchain/server"
/server/tsconfig.json
/server/src/index.ts             Express + http + Socket.IO bootstrap
/server/src/rooms/roomCode.ts    room code generator (pure, injectable RNG)
/server/src/rooms/Room.ts        single room's state (players, teams, round state)
/server/src/rooms/RoomManager.ts creates/looks up/removes rooms
/server/src/socket/registerHostHandlers.ts
/server/src/socket/registerPlayerHandlers.ts
/server/tests/*.test.ts          unit tests + socket.io-client integration tests

/client/package.json             "@wordchain/client"
/client/vite.config.ts
/client/tailwind.config.js
/client/index.html
/client/src/main.tsx
/client/src/App.tsx              route shell (Join / Host* / Player* pages)
/client/src/socket.ts            typed socket.io-client wrapper
/client/src/sound.ts             Web Audio API tone feedback (no external audio assets)
/client/src/components/LetterCell.tsx
/client/src/components/ChainRow.tsx
/client/src/components/ChainBoard.tsx     the signature letter-grid UI
/client/src/pages/JoinPage.tsx
/client/src/pages/HostSetupPage.tsx
/client/src/pages/HostLobbyPage.tsx
/client/src/pages/PlayerLobbyPage.tsx
/client/src/pages/PlayerRoundPage.tsx
/client/src/pages/HostRoundPage.tsx
/client/src/pages/ResultsPage.tsx
/client/src/pages/FinalResultsPage.tsx
/client/tests/*.test.tsx
```

---

## Task 1: Scaffold the monorepo

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `shared/package.json`, `shared/tsconfig.json`
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `client/package.json` (via Vite scaffold, then edited)

**Interfaces:**
- Produces: three npm workspaces (`shared`, `server`, `client`) that can `import` from each other via package name `@wordchain/shared`.

- [ ] **Step 1: Create the root package.json with workspaces**

```json
{
  "name": "word-chain",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json at the root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  }
}
```

- [ ] **Step 3: Scaffold the shared package**

Create `shared/package.json`:

```json
{
  "name": "@wordchain/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Create `shared/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create an empty `shared/src/index.ts` (barrel file, populated by later tasks):

```ts
export * from "./types.js";
export * from "./chainSolver.js";
export * from "./scoring.js";
export * from "./puzzleValidation.js";
```

- [ ] **Step 4: Scaffold the server package**

Create `server/package.json`:

```json
{
  "name": "@wordchain/server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@wordchain/shared": "*",
    "express": "^4.19.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.14.0",
    "socket.io-client": "^4.7.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Scaffold the client package with Vite**

Run:

```bash
npm create vite@latest client -- --template react-ts
```

Then edit `client/package.json` to add dependencies (merge into the generated file, keep the generated `scripts`/`devDependencies` from Vite and add these):

```json
{
  "dependencies": {
    "@phosphor-icons/react": "^2.1.0",
    "@wordchain/shared": "*",
    "canvas-confetti": "^1.9.0",
    "framer-motion": "^11.2.0",
    "qrcode.react": "^3.1.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/canvas-confetti": "^1.6.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.6.0"
  }
}
```

Add a `test` script to `client/package.json`'s `scripts`: `"test": "vitest run"`.

- [ ] **Step 6: Install everything**

Run: `npm install` (from the repo root)
Expected: completes with no errors; `node_modules` created at root with workspace symlinks for `@wordchain/shared` inside `server/node_modules` and `client/node_modules`.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.base.json shared/package.json shared/tsconfig.json shared/src/index.ts server/package.json server/tsconfig.json client/ .gitignore
git commit -m "Scaffold npm workspaces monorepo (shared, server, client)"
```

Note: check `client/.gitignore` (from the Vite scaffold) already excludes `node_modules` and `dist` — if the root doesn't have a `.gitignore` covering `**/node_modules` and `**/dist`, add those lines to the root `.gitignore` before this commit.

---

## Task 2: Shared types

**Files:**
- Create: `shared/src/types.ts`

**Interfaces:**
- Consumes: nothing (foundational types)
- Produces: `GameMode`, `PlayerInfo`, `TeamInfo`, `Puzzle`, `RoundResult` types imported by every later shared/server/client task.

- [ ] **Step 1: Write the types file**

```ts
// shared/src/types.ts

export type GameMode = "individual" | "team";

export interface Puzzle {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  words: string[];
  timeCapSeconds: number;
}

export interface PlayerInfo {
  socketId: string;
  nickname: string;
  teamId: string | null;
  connected: boolean;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export interface RoundResult {
  entrantId: string; // socketId (individual mode) or teamId (team mode)
  displayName: string;
  finished: boolean;
  rowsSolved: number;
  totalRows: number;
  rawTimeSeconds: number | null; // null if not finished
  points: number;
}

```

Note: `RoundStartedPayload` (the shape of the `"round:started"` broadcast) is added later, in Task 14, to `shared/src/chainSolver.ts` right next to `toPublicRows`/`PublicChainRow` — it isn't defined here because it depends on `PublicChainRow`, which doesn't exist until that task.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p shared/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "Add shared game types"
```

---

## Task 3: Chain solver (two-pointer solve state machine)

This is the core mechanic: a chain's blanks are solved inward from both ends. Two pointers (`topSolved`, `bottomSolved`) track the last-solved index from each side; only the rows adjacent to those pointers are "active."

**Files:**
- Create: `shared/src/chainSolver.ts`
- Test: `shared/tests/chainSolver.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `createChainState(words: string[]): ChainState`, `getActiveRows(state: ChainState): number[]`, `isComplete(state: ChainState): boolean`, `submitGuess(state: ChainState, rowIndex: number, guess: string): { state: ChainState; correct: boolean }`, `applyHint(state: ChainState, rowIndex: number): ChainState`, `WRONG_GUESS_PENALTY_SECONDS`, `HINT_PENALTY_SECONDS` constants — all consumed by Task 15/16 (server round handlers) and Task 22 (client ChainBoard).

- [ ] **Step 1: Write the failing tests**

Create `shared/tests/chainSolver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  createChainState,
  getActiveRows,
  isComplete,
  submitGuess,
  applyHint,
  WRONG_GUESS_PENALTY_SECONDS,
  HINT_PENALTY_SECONDS,
} from "../src/chainSolver.js";

const CHAIN = ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"];

describe("createChainState", () => {
  it("starts with the top and bottom clue rows solved", () => {
    const state = createChainState(CHAIN);
    expect(state.topSolved).toBe(0);
    expect(state.bottomSolved).toBe(5);
    expect(state.penaltySeconds).toBe(0);
  });
});

describe("getActiveRows", () => {
  it("returns the row after the top clue and before the bottom clue", () => {
    const state = createChainState(CHAIN);
    expect(getActiveRows(state)).toEqual([1, 4]);
  });

  it("returns a single row when the pointers converge", () => {
    const state = createChainState(CHAIN);
    expect(isComplete(state)).toBe(false);
  });

  it("returns an empty array once solved", () => {
    let state = createChainState(["HOT", "DOG", "KICK"]);
    const result = submitGuess(state, 1, "dog");
    expect(getActiveRows(result.state)).toEqual([]);
  });
});

describe("submitGuess", () => {
  it("accepts a correct guess case-insensitively and trims whitespace", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "  dog  ");
    expect(result.correct).toBe(true);
    expect(result.state.topSolved).toBe(1);
  });

  it("advances topSolved when the top-active row is solved", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "DOG");
    expect(getActiveRows(result.state)).toEqual([2, 4]);
  });

  it("advances bottomSolved when the bottom-active row is solved", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 4, "SIDE");
    expect(result.state.bottomSolved).toBe(4);
    expect(getActiveRows(result.state)).toEqual([1, 3]);
  });

  it("adds a time penalty on a wrong guess and does not advance pointers", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "CAT");
    expect(result.correct).toBe(false);
    expect(result.state.topSolved).toBe(0);
    expect(result.state.penaltySeconds).toBe(WRONG_GUESS_PENALTY_SECONDS);
  });

  it("throws if guessing a row that is not currently active", () => {
    const state = createChainState(CHAIN);
    expect(() => submitGuess(state, 3, "ALONG")).toThrow(/not active/);
  });

  it("completes the chain when both pointers converge on the final row", () => {
    let state = createChainState(CHAIN);
    state = submitGuess(state, 1, "DOG").state; // active: [2,4]
    state = submitGuess(state, 4, "SIDE").state; // active: [2,3]
    state = submitGuess(state, 2, "TAG").state; // active: [3] (converged)
    expect(getActiveRows(state)).toEqual([3]);
    expect(isComplete(state)).toBe(false);
    const finalResult = submitGuess(state, 3, "ALONG");
    expect(finalResult.correct).toBe(true);
    expect(isComplete(finalResult.state)).toBe(true);
    expect(getActiveRows(finalResult.state)).toEqual([]);
  });

  it("handles a minimal 3-word chain (single blank) from either direction", () => {
    const state = createChainState(["HOT", "DOG", "KICK"]);
    expect(getActiveRows(state)).toEqual([1]);
    const result = submitGuess(state, 1, "DOG");
    expect(result.correct).toBe(true);
    expect(isComplete(result.state)).toBe(true);
  });
});

describe("applyHint", () => {
  it("reveals one additional letter and adds the hint penalty", () => {
    const state = createChainState(CHAIN);
    const hinted = applyHint(state, 1);
    expect(hinted.revealedLetters[1]).toBe(1);
    expect(hinted.penaltySeconds).toBe(HINT_PENALTY_SECONDS);
  });

  it("does not reveal past the word's length", () => {
    let state = createChainState(["HOT", "DOG", "KICK"]);
    state = applyHint(state, 1); // reveals 1 of 3
    state = applyHint(state, 1); // reveals 2 of 3
    state = applyHint(state, 1); // reveals 3 of 3
    state = applyHint(state, 1); // no-op, already fully revealed
    expect(state.revealedLetters[1]).toBe(3);
    expect(state.penaltySeconds).toBe(HINT_PENALTY_SECONDS * 3);
  });

  it("throws if hinting a row that is not currently active", () => {
    const state = createChainState(CHAIN);
    expect(() => applyHint(state, 3)).toThrow(/not active/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=shared`
Expected: FAIL — `Cannot find module '../src/chainSolver.js'`

- [ ] **Step 3: Implement chainSolver.ts**

```ts
// shared/src/chainSolver.ts

export const WRONG_GUESS_PENALTY_SECONDS = 3;
export const HINT_PENALTY_SECONDS = 5;

export interface ChainState {
  words: string[];
  topSolved: number;
  bottomSolved: number;
  revealedLetters: number[];
  penaltySeconds: number;
}

export function createChainState(words: string[]): ChainState {
  return {
    words,
    topSolved: 0,
    bottomSolved: words.length - 1,
    revealedLetters: new Array(words.length).fill(0),
    penaltySeconds: 0,
  };
}

export function getActiveRows(state: ChainState): number[] {
  const top = state.topSolved + 1;
  const bottom = state.bottomSolved - 1;
  if (top > bottom) return [];
  if (top === bottom) return [top];
  return [top, bottom];
}

export function isComplete(state: ChainState): boolean {
  return state.topSolved + 1 > state.bottomSolved - 1;
}

function assertActive(state: ChainState, rowIndex: number): void {
  if (!getActiveRows(state).includes(rowIndex)) {
    throw new Error(`Row ${rowIndex} is not active`);
  }
}

export function submitGuess(
  state: ChainState,
  rowIndex: number,
  guess: string
): { state: ChainState; correct: boolean } {
  assertActive(state, rowIndex);
  const normalized = guess.trim().toUpperCase();
  const correct = normalized === state.words[rowIndex].toUpperCase();

  if (!correct) {
    return {
      state: { ...state, penaltySeconds: state.penaltySeconds + WRONG_GUESS_PENALTY_SECONDS },
      correct: false,
    };
  }

  const next: ChainState = { ...state };
  if (rowIndex === state.topSolved + 1) next.topSolved = rowIndex;
  if (rowIndex === state.bottomSolved - 1) next.bottomSolved = rowIndex;
  return { state: next, correct: true };
}

export function applyHint(state: ChainState, rowIndex: number): ChainState {
  assertActive(state, rowIndex);
  const wordLength = state.words[rowIndex].length;
  const currentRevealed = state.revealedLetters[rowIndex];
  if (currentRevealed >= wordLength) return state;

  const revealedLetters = [...state.revealedLetters];
  revealedLetters[rowIndex] = currentRevealed + 1;
  return {
    ...state,
    revealedLetters,
    penaltySeconds: state.penaltySeconds + HINT_PENALTY_SECONDS,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=shared`
Expected: PASS — all `chainSolver` tests green.

- [ ] **Step 5: Export from the barrel file**

Confirm `shared/src/index.ts` already includes `export * from "./chainSolver.js";` (added in Task 1). No change needed if so.

- [ ] **Step 6: Commit**

```bash
git add shared/src/chainSolver.ts shared/tests/chainSolver.test.ts
git commit -m "Add chain solver two-pointer state machine with tests"
```

---

## Task 4: Scoring formulas

**Files:**
- Create: `shared/src/scoring.ts`
- Test: `shared/tests/scoring.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `computeFinisherPoints(yourTimeSeconds, fastestTimeSeconds): number`, `computeNonFinisherPoints(rowsSolved, totalRows): number` — consumed by Task 17 (server round-end scoring).

- [ ] **Step 1: Write the failing tests**

Create `shared/tests/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeFinisherPoints, computeNonFinisherPoints } from "../src/scoring.js";

describe("computeFinisherPoints", () => {
  it("gives the fastest player exactly 1000 points", () => {
    expect(computeFinisherPoints(30, 30)).toBe(1000);
  });

  it("scales down proportionally for a slower time", () => {
    // fastest = 30s, this player = 60s -> 1000 * 30/60 = 500
    expect(computeFinisherPoints(60, 30)).toBe(500);
  });

  it("clamps to a floor of 300 for a very slow finish", () => {
    // fastest = 10s, this player = 1000s -> raw would be 10, clamp to 300
    expect(computeFinisherPoints(1000, 10)).toBe(300);
  });

  it("never exceeds 1000 even if somehow faster than the recorded fastest", () => {
    expect(computeFinisherPoints(10, 30)).toBe(1000);
  });

  it("throws for non-positive times", () => {
    expect(() => computeFinisherPoints(0, 30)).toThrow();
    expect(() => computeFinisherPoints(30, 0)).toThrow();
  });
});

describe("computeNonFinisherPoints", () => {
  it("awards proportional partial credit", () => {
    // 2 of 4 rows solved -> 200 * 2/4 = 100
    expect(computeNonFinisherPoints(2, 4)).toBe(100);
  });

  it("returns 0 for no progress", () => {
    expect(computeNonFinisherPoints(0, 4)).toBe(0);
  });

  it("stays below the finisher floor even at full progress", () => {
    expect(computeNonFinisherPoints(4, 4)).toBeLessThan(300);
  });

  it("throws for non-positive totalRows", () => {
    expect(() => computeNonFinisherPoints(1, 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=shared`
Expected: FAIL — `Cannot find module '../src/scoring.js'`

- [ ] **Step 3: Implement scoring.ts**

```ts
// shared/src/scoring.ts

export const FINISHER_MIN_POINTS = 300;
export const FINISHER_MAX_POINTS = 1000;
export const NON_FINISHER_MAX_POINTS = 200;

export function computeFinisherPoints(yourTimeSeconds: number, fastestTimeSeconds: number): number {
  if (yourTimeSeconds <= 0) throw new Error("yourTimeSeconds must be positive");
  if (fastestTimeSeconds <= 0) throw new Error("fastestTimeSeconds must be positive");
  const raw = Math.round((FINISHER_MAX_POINTS * fastestTimeSeconds) / yourTimeSeconds);
  return Math.min(FINISHER_MAX_POINTS, Math.max(FINISHER_MIN_POINTS, raw));
}

export function computeNonFinisherPoints(rowsSolved: number, totalRows: number): number {
  if (totalRows <= 0) throw new Error("totalRows must be positive");
  const raw = Math.round((NON_FINISHER_MAX_POINTS * rowsSolved) / totalRows);
  return Math.max(0, raw);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=shared`
Expected: PASS — all `scoring` tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/scoring.ts shared/tests/scoring.test.ts
git commit -m "Add scoring formulas with tests"
```

---

## Task 5: Puzzle structural validation

**Files:**
- Create: `shared/src/puzzleValidation.ts`
- Test: `shared/tests/puzzleValidation.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `validatePuzzleWords(words: string[]): PuzzleValidationError[]` — consumed by Task 9 (puzzle library self-check) and the client custom puzzle creator (Task 24).

- [ ] **Step 1: Write the failing tests**

Create `shared/tests/puzzleValidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validatePuzzleWords } from "../src/puzzleValidation.js";

describe("validatePuzzleWords", () => {
  it("passes a valid chain with no errors", () => {
    expect(validatePuzzleWords(["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"])).toEqual([]);
  });

  it("passes the minimal valid chain of 3 words", () => {
    expect(validatePuzzleWords(["HOT", "DOG", "KICK"])).toEqual([]);
  });

  it("flags a chain shorter than 3 words", () => {
    const errors = validatePuzzleWords(["HOT", "DOG"]);
    expect(errors.some((e) => /at least 3 words/.test(e.message))).toBe(true);
  });

  it("flags an empty word", () => {
    const errors = validatePuzzleWords(["HOT", "", "KICK"]);
    expect(errors.some((e) => /position 2/.test(e.message))).toBe(true);
  });

  it("flags a word with non-letter characters", () => {
    const errors = validatePuzzleWords(["HOT", "DOG2", "KICK"]);
    expect(errors.some((e) => /only letters/.test(e.message))).toBe(true);
  });

  it("flags duplicate consecutive words", () => {
    const errors = validatePuzzleWords(["HOT", "DOG", "DOG", "KICK"]);
    expect(errors.some((e) => /identical/.test(e.message))).toBe(true);
  });

  it("returns multiple errors when multiple problems exist", () => {
    const errors = validatePuzzleWords(["HOT", "", "DOG2"]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=shared`
Expected: FAIL — `Cannot find module '../src/puzzleValidation.js'`

- [ ] **Step 3: Implement puzzleValidation.ts**

```ts
// shared/src/puzzleValidation.ts

export interface PuzzleValidationError {
  message: string;
}

const LETTERS_ONLY = /^[A-Za-z]+$/;

export function validatePuzzleWords(words: string[]): PuzzleValidationError[] {
  const errors: PuzzleValidationError[] = [];

  if (words.length < 3) {
    errors.push({ message: "A puzzle needs at least 3 words (2 clues + at least 1 blank)." });
  }

  words.forEach((word, index) => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      errors.push({ message: `Word at position ${index + 1} is empty.` });
    } else if (!LETTERS_ONLY.test(trimmed)) {
      errors.push({ message: `Word at position ${index + 1} ("${word}") must contain only letters.` });
    }
  });

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].trim().toUpperCase() === words[i + 1].trim().toUpperCase()) {
      errors.push({ message: `Words at position ${i + 1} and ${i + 2} are identical ("${words[i]}").` });
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=shared`
Expected: PASS — all `puzzleValidation` tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/puzzleValidation.ts shared/tests/puzzleValidation.test.ts
git commit -m "Add puzzle structural validation with tests"
```

---

## Task 6: Room code generator

**Files:**
- Create: `server/src/rooms/roomCode.ts`
- Test: `server/tests/roomCode.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `generateRoomCode(randomFn?: () => number): string` — consumed by Task 8 (`RoomManager`).

- [ ] **Step 1: Write the failing tests**

Create `server/tests/roomCode.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateRoomCode } from "../src/rooms/roomCode.js";

describe("generateRoomCode", () => {
  it("matches the WORD-NN format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]+-\d{2}$/);
  });

  it("is deterministic given a fixed random function", () => {
    const fixedRandom = () => 0; // always picks the first adjective, min number
    const code = generateRoomCode(fixedRandom);
    expect(code).toBe(generateRoomCode(fixedRandom));
  });

  it("produces different codes for different random inputs", () => {
    const codeA = generateRoomCode(() => 0);
    const codeB = generateRoomCode(() => 0.99);
    expect(codeA).not.toBe(codeB);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `Cannot find module '../src/rooms/roomCode.js'`

- [ ] **Step 3: Implement roomCode.ts**

```ts
// server/src/rooms/roomCode.ts

const ADJECTIVES = ["BLUE", "RED", "GOLD", "SWIFT", "LUCKY", "BRAVE", "SUNNY", "ROYAL"];

export function generateRoomCode(randomFn: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(randomFn() * ADJECTIVES.length)];
  const number = Math.floor(randomFn() * 90) + 10; // 10-99
  return `${adjective}-${number}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS — all `roomCode` tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomCode.ts server/tests/roomCode.test.ts
git commit -m "Add room code generator with tests"
```

---

## Task 7: Room state

**Files:**
- Create: `server/src/rooms/Room.ts`
- Test: `server/tests/Room.test.ts`

**Interfaces:**
- Consumes: `PlayerInfo`, `TeamInfo`, `GameMode` from `@wordchain/shared`
- Produces: `Room` class with `addPlayer`, `removePlayer`, `setConnected`, `assignTeam`, `getPlayers()`, `code`, `hostSocketId`, `mode`, `teams` — consumed by Task 8 (`RoomManager`) and every socket handler task (11-18).

- [ ] **Step 1: Write the failing tests**

Create `server/tests/Room.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Room } from "../src/rooms/Room.js";

describe("Room", () => {
  it("starts with no players and individual mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    expect(room.code).toBe("BLUE-42");
    expect(room.hostSocketId).toBe("host-socket-1");
    expect(room.mode).toBe("individual");
    expect(room.getPlayers()).toEqual([]);
  });

  it("adds a player with no team by default", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    const player = room.addPlayer("p1", "Alex");
    expect(player).toEqual({ socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    expect(room.getPlayers()).toHaveLength(1);
  });

  it("removes a player", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.removePlayer("p1");
    expect(room.getPlayers()).toEqual([]);
  });

  it("marks a player as disconnected without removing them", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.setConnected("p1", false);
    expect(room.getPlayers()[0].connected).toBe(false);
  });

  it("assigns a player to a defined team", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.assignTeam("p1", "t1");
    expect(room.getPlayers()[0].teamId).toBe("t1");
  });

  it("throws when assigning a player to a team that does not exist", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    expect(() => room.assignTeam("p1", "unknown-team")).toThrow(/does not exist/);
  });

  it("throws when assigning an unknown player to a team", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    expect(() => room.assignTeam("unknown-player", "t1")).toThrow(/does not exist/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `Cannot find module '../src/rooms/Room.js'`

- [ ] **Step 3: Implement Room.ts**

```ts
// server/src/rooms/Room.ts

import type { GameMode, PlayerInfo, TeamInfo } from "@wordchain/shared";

export class Room {
  code: string;
  hostSocketId: string;
  mode: GameMode = "individual";
  teams: TeamInfo[] = [];
  private players = new Map<string, PlayerInfo>();

  constructor(code: string, hostSocketId: string) {
    this.code = code;
    this.hostSocketId = hostSocketId;
  }

  addPlayer(socketId: string, nickname: string): PlayerInfo {
    const player: PlayerInfo = { socketId, nickname, teamId: null, connected: true };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId: string): void {
    this.players.delete(socketId);
  }

  setConnected(socketId: string, connected: boolean): void {
    const player = this.players.get(socketId);
    if (player) player.connected = connected;
  }

  assignTeam(socketId: string, teamId: string): void {
    const player = this.players.get(socketId);
    if (!player) throw new Error(`Player ${socketId} does not exist`);
    if (!this.teams.some((t) => t.id === teamId)) {
      throw new Error(`Team ${teamId} does not exist`);
    }
    player.teamId = teamId;
  }

  getPlayers(): PlayerInfo[] {
    return [...this.players.values()];
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS — all `Room` tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/Room.ts server/tests/Room.test.ts
git commit -m "Add Room state with player/team management and tests"
```

---

## Task 8: Room manager

**Files:**
- Create: `server/src/rooms/RoomManager.ts`
- Test: `server/tests/RoomManager.test.ts`

**Interfaces:**
- Consumes: `Room` (Task 7), `generateRoomCode` (Task 6)
- Produces: `RoomManager` class with `createRoom(hostSocketId): Room`, `getRoom(code): Room | undefined`, `removeRoom(code): void` — consumed by Task 10 (server bootstrap) and all socket handler tasks.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/RoomManager.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { RoomManager } from "../src/rooms/RoomManager.js";

describe("RoomManager", () => {
  it("creates a room with a generated code and the given host", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(room.hostSocketId).toBe("host-1");
    expect(room.code).toMatch(/^[A-Z]+-\d{2}$/);
  });

  it("retrieves a room by its code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(manager.getRoom(room.code)).toBe(room);
  });

  it("returns undefined for an unknown code", () => {
    const manager = new RoomManager();
    expect(manager.getRoom("NOPE-00")).toBeUndefined();
  });

  it("removes a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    manager.removeRoom(room.code);
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it("never generates two rooms with the same code while both exist", () => {
    // Force collisions: first two calls return the same value, third call is unique.
    let callCount = 0;
    const collidingRandom = () => {
      callCount++;
      return callCount <= 2 ? 0 : 0.5;
    };
    const manager = new RoomManager(collidingRandom);
    const roomA = manager.createRoom("host-1");
    const roomB = manager.createRoom("host-2");
    expect(roomA.code).not.toBe(roomB.code);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `Cannot find module '../src/rooms/RoomManager.js'`

- [ ] **Step 3: Implement RoomManager.ts**

```ts
// server/src/rooms/RoomManager.ts

import { Room } from "./Room.js";
import { generateRoomCode } from "./roomCode.js";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private randomFn: () => number;

  constructor(randomFn: () => number = Math.random) {
    this.randomFn = randomFn;
  }

  createRoom(hostSocketId: string): Room {
    let code = generateRoomCode(this.randomFn);
    while (this.rooms.has(code)) {
      code = generateRoomCode(this.randomFn);
    }
    const room = new Room(code, hostSocketId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS — all `RoomManager` tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/RoomManager.ts server/tests/RoomManager.test.ts
git commit -m "Add RoomManager with collision-free code assignment and tests"
```

---

## Task 9: Curated puzzle library

Lives in `shared` (not `server`) so both the server and the client's host setup screen (Task 25, puzzle picker) import the exact same data with no duplication.

**Files:**
- Create: `shared/src/puzzles.ts`
- Modify: `shared/src/index.ts` (export it from the barrel)
- Test: `shared/tests/puzzles.test.ts`

**Interfaces:**
- Consumes: `validatePuzzleWords` (Task 5), `Puzzle` type (Task 2)
- Produces: `PUZZLE_LIBRARY: Puzzle[]` — consumed by Task 25 (client host setup playlist picker).

- [ ] **Step 1: Write the failing test**

Create `shared/tests/puzzles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validatePuzzleWords } from "../src/puzzleValidation.js";
import { PUZZLE_LIBRARY } from "../src/puzzles.js";

describe("PUZZLE_LIBRARY", () => {
  it("contains at least 6 puzzles", () => {
    expect(PUZZLE_LIBRARY.length).toBeGreaterThanOrEqual(6);
  });

  it("has a unique id for every puzzle", () => {
    const ids = PUZZLE_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has structurally valid word chains for every puzzle", () => {
    for (const puzzle of PUZZLE_LIBRARY) {
      expect(validatePuzzleWords(puzzle.words)).toEqual([]);
    }
  });

  it("gives every puzzle a positive time cap", () => {
    for (const puzzle of PUZZLE_LIBRARY) {
      expect(puzzle.timeCapSeconds).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=shared`
Expected: FAIL — `Cannot find module '../src/puzzles.js'`

- [ ] **Step 3: Implement puzzles.ts**

```ts
// shared/src/puzzles.ts

import type { Puzzle } from "./types.js";

export const PUZZLE_LIBRARY: Puzzle[] = [
  {
    id: "hotdog-sidekick",
    category: "Classics",
    difficulty: "easy",
    words: ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"],
    timeCapSeconds: 90,
  },
  {
    id: "sun-flower-bed",
    category: "Nature",
    difficulty: "easy",
    words: ["SUN", "FLOWER", "BED", "ROOM"],
    timeCapSeconds: 60,
  },
  {
    id: "basket-ball-room",
    category: "Sports",
    difficulty: "medium",
    words: ["BASKET", "BALL", "ROOM", "MATE"],
    timeCapSeconds: 60,
  },
  {
    id: "fire-fly-weight",
    category: "Nature",
    difficulty: "medium",
    words: ["FIRE", "FLY", "WEIGHT", "LIFTING"],
    timeCapSeconds: 60,
  },
  {
    id: "star-fish-tank",
    category: "Animals",
    difficulty: "medium",
    words: ["STAR", "FISH", "TANK", "TOP"],
    timeCapSeconds: 60,
  },
  {
    id: "note-book-case",
    category: "Everyday",
    difficulty: "easy",
    words: ["NOTE", "BOOK", "CASE"],
    timeCapSeconds: 45,
  },
  {
    id: "moon-light-house-hold",
    category: "Classics",
    difficulty: "hard",
    words: ["MOON", "LIGHT", "HOUSE", "HOLD"],
    timeCapSeconds: 75,
  },
];
```

- [ ] **Step 4: Export it from the shared barrel**

Add to `shared/src/index.ts`:

```ts
export * from "./puzzles.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=shared`
Expected: PASS — all `puzzles` tests green.

- [ ] **Step 6: Commit**

```bash
git add shared/src/puzzles.ts shared/src/index.ts shared/tests/puzzles.test.ts
git commit -m "Add curated puzzle library (shared) with structural validation test"
```

---

## Task 10: Server bootstrap (Express + Socket.IO)

**Files:**
- Create: `server/src/index.ts`
- Test: `server/tests/index.test.ts`

**Interfaces:**
- Consumes: `RoomManager` (Task 8)
- Produces: `createServer(): { httpServer, io, roomManager }` — an exported factory (not just a side-effecting script) so tests can spin up isolated instances on ephemeral ports. Consumed by every socket handler test (Tasks 11-18) and by the real `npm run dev` entrypoint.

- [ ] **Step 1: Write the failing test**

Create `server/tests/index.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("server bootstrap", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("accepts a socket.io connection", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const port = address.port;

    const client: Socket = ioClient(`http://localhost:${port}`);
    cleanup = () => {
      client.close();
      io.close();
      httpServer.close();
    };

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", reject);
    });

    expect(client.connected).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `Cannot find module '../src/index.js'` (or no `createServer` export)

- [ ] **Step 3: Implement index.ts**

```ts
// server/src/index.ts

import { createServer as createHttpServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager.js";

export function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  const roomManager = new RoomManager();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return { app, httpServer, io, roomManager };
}

// Only start listening when this file is run directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpServer } = createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  httpServer.listen(port, () => {
    console.log(`Word Chain server listening on port ${port}`);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts server/tests/index.test.ts
git commit -m "Add Express/Socket.IO server bootstrap with connection test"
```

---

## Task 11: Host handler — create room

Establishes the socket event contract used by every later handler task: client emits an event with a payload and an ack callback; the server responds via that callback rather than a separate event, for request/response-shaped actions.

**Files:**
- Create: `server/src/socket/registerHostHandlers.ts`
- Modify: `server/src/index.ts` (wire the handler into `io.on("connection", ...)`)
- Test: `server/tests/registerHostHandlers.test.ts`

**Interfaces:**
- Consumes: `RoomManager` (Task 8), `GameMode`/`TeamInfo` types (Task 2)
- Produces: `registerHostHandlers(io, socket, roomManager)`; event `"host:createRoom"` with payload `{ mode: GameMode; teams?: TeamInfo[] }` and ack `{ code?: string; error?: string }`. Consumed by Task 25 (client HostSetupPage).

- [ ] **Step 1: Write the failing test**

Create `server/tests/registerHostHandlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("host:createRoom", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function connectClient() {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const client: Socket = ioClient(`http://localhost:${address.port}`);
    await new Promise<void>((resolve) => client.on("connect", resolve));
    cleanup = () => {
      client.close();
      io.close();
      httpServer.close();
    };
    return { client, roomManager };
  }

  it("creates a room and returns a room code", async () => {
    const { client, roomManager } = await connectClient();

    const response = await new Promise<{ code?: string; error?: string }>((resolve) => {
      client.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    expect(response.code).toMatch(/^[A-Z]+-\d{2}$/);
    expect(roomManager.getRoom(response.code!)?.mode).toBe("individual");
  });

  it("stores the provided teams when creating a team-mode room", async () => {
    const { client, roomManager } = await connectClient();
    const teams = [{ id: "t1", name: "Red Team" }];

    const response = await new Promise<{ code?: string }>((resolve) => {
      client.emit("host:createRoom", { mode: "team", teams }, resolve);
    });

    expect(roomManager.getRoom(response.code!)?.teams).toEqual(teams);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `host:createRoom` never responds (timeout) since nothing is registered yet.

- [ ] **Step 3: Implement registerHostHandlers.ts**

```ts
// server/src/socket/registerHostHandlers.ts

import type { Server, Socket } from "socket.io";
import type { GameMode, TeamInfo } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

export interface CreateRoomPayload {
  mode: GameMode;
  teams?: TeamInfo[];
}

export interface CreateRoomResponse {
  code?: string;
  error?: string;
}

export function registerHostHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "host:createRoom",
    (payload: CreateRoomPayload, callback: (response: CreateRoomResponse) => void) => {
      const room = roomManager.createRoom(socket.id);
      room.mode = payload.mode;
      if (payload.teams) room.teams = payload.teams;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      callback({ code: room.code });
    }
  );
}
```

- [ ] **Step 4: Wire it into the server bootstrap**

Modify `server/src/index.ts` — add the import and a connection handler:

```ts
// add near the top with the other imports
import { registerHostHandlers } from "./socket/registerHostHandlers.js";
```

Add this right after `const roomManager = new RoomManager();` and before the `return`:

```ts
  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/socket/registerHostHandlers.ts server/src/index.ts server/tests/registerHostHandlers.test.ts
git commit -m "Add host:createRoom handler with tests"
```

---

## Task 12: Player handler — join room

**Files:**
- Create: `server/src/socket/registerPlayerHandlers.ts`
- Modify: `server/src/index.ts` (register the new handler)
- Test: `server/tests/registerPlayerHandlers.test.ts`

**Interfaces:**
- Consumes: `RoomManager`/`Room` (Tasks 7-8)
- Produces: `registerPlayerHandlers(io, socket, roomManager)`; event `"player:joinRoom"` payload `{ code: string; nickname: string }`, ack `{ success: boolean; error?: string }`; broadcast event `"room:playerJoined"` payload `{ socketId, nickname, teamId, connected }` sent to everyone else already in the room. Consumed by Task 26 (client JoinPage) and Task 27 (Lobby pages).

- [ ] **Step 1: Write the failing tests**

Create `server/tests/registerPlayerHandlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("player:joinRoom", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setup() {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    cleanup = () => {
      host.close();
      io.close();
      httpServer.close();
    };

    return { url, code, host, roomManager };
  }

  it("adds the player to the room and acknowledges success", async () => {
    const { url, code, roomManager } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(true);
    expect(roomManager.getRoom(code)?.getPlayers()).toHaveLength(1);
    player.close();
  });

  it("notifies the host when a player joins", async () => {
    const { url, code, host } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const joinedEventPromise = new Promise<{ nickname: string }>((resolve) => {
      host.once("room:playerJoined", resolve);
    });
    player.emit("player:joinRoom", { code, nickname: "Alex" }, () => {});

    const event = await joinedEventPromise;
    expect(event.nickname).toBe("Alex");
    player.close();
  });

  it("rejects joining a room that does not exist", async () => {
    const { url } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("player:joinRoom", { code: "NOPE-00", nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/not found/i);
    player.close();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `player:joinRoom` never responds (timeout).

- [ ] **Step 3: Implement registerPlayerHandlers.ts**

```ts
// server/src/socket/registerPlayerHandlers.ts

import type { Server, Socket } from "socket.io";
import type { GameMode, TeamInfo } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

export interface JoinRoomPayload {
  code: string;
  nickname: string;
}

export interface JoinRoomResponse {
  success: boolean;
  error?: string;
  mode?: GameMode;
  teams?: TeamInfo[];
}

export function registerPlayerHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "player:joinRoom",
    (payload: JoinRoomPayload, callback: (response: JoinRoomResponse) => void) => {
      const room = roomManager.getRoom(payload.code);
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      const player = room.addPlayer(socket.id, payload.nickname);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.to(room.code).emit("room:playerJoined", player);
      callback({ success: true, mode: room.mode, teams: room.teams });
    }
  );
}
```

- [ ] **Step 4: Wire it into the server bootstrap**

Modify `server/src/index.ts`:

```ts
// add near the other imports
import { registerPlayerHandlers } from "./socket/registerPlayerHandlers.js";
```

Update the connection handler added in Task 11 to also register player handlers:

```ts
  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/socket/registerPlayerHandlers.ts server/src/index.ts server/tests/registerPlayerHandlers.test.ts
git commit -m "Add player:joinRoom handler with tests"
```

Note the convention introduced here: every handler that acts "on behalf of the calling socket" (as opposed to taking an explicit room code) reads the room from `socket.data.roomCode`, set once at `host:createRoom` or `player:joinRoom` time. Tasks 13+ rely on this.

---

## Task 13: Player handler — select team

**Files:**
- Modify: `server/src/socket/registerPlayerHandlers.ts` (add a second handler)
- Test: `server/tests/registerPlayerHandlers.test.ts` (add tests)

**Interfaces:**
- Consumes: `Room.assignTeam` (Task 7), `socket.data.roomCode` convention (Task 12)
- Produces: event `"player:selectTeam"` payload `{ teamId: string }`, ack `{ success: boolean; error?: string }`; broadcast `"room:playerUpdated"` payload `{ socketId, nickname, teamId, connected }` to the whole room (including the sender, so their own UI updates too). Consumed by Task 27 (client team-select lobby screen).

- [ ] **Step 1: Add the failing tests**

Append to `server/tests/registerPlayerHandlers.test.ts` (inside the existing `describe("player:joinRoom", ...)` block is fine, or a new sibling `describe` — add this new `describe` block after the existing one, still in the same file, reusing the `setup()` helper already defined above):

```ts
describe("player:selectTeam", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("assigns the player to a team and broadcasts the update", async () => {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "team", teams: [{ id: "t1", name: "Red Team" }] }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const updatedEventPromise = new Promise<{ teamId: string | null }>((resolve) => {
      player.once("room:playerUpdated", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:selectTeam", { teamId: "t1" }, resolve);
    });

    expect(response.success).toBe(true);
    expect((await updatedEventPromise).teamId).toBe("t1");
    expect(roomManager.getRoom(code)?.getPlayers()[0].teamId).toBe("t1");
  });

  it("rejects selecting a team that does not exist", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "team", teams: [{ id: "t1", name: "Red Team" }] }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("player:selectTeam", { teamId: "unknown" }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/does not exist/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `player:selectTeam` never responds (timeout).

- [ ] **Step 3: Add the handler to registerPlayerHandlers.ts**

Add this inside `registerPlayerHandlers`, after the existing `player:joinRoom` handler:

```ts
  socket.on(
    "player:selectTeam",
    (payload: { teamId: string }, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      try {
        room.assignTeam(socket.id, payload.teamId);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const updatedPlayer = room.getPlayers().find((p) => p.socketId === socket.id)!;
      io.to(room.code).emit("room:playerUpdated", updatedPlayer);
      callback({ success: true });
    }
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/socket/registerPlayerHandlers.ts server/tests/registerPlayerHandlers.test.ts
git commit -m "Add player:selectTeam handler with tests"
```

---

## Task 14: Round start (host-only)

Adds round state to `Room`, a shared helper to describe a puzzle's rows without leaking solutions over the wire, and the host-only `host:startRound` event.

**Files:**
- Modify: `shared/src/chainSolver.ts` (add `toPublicRows`)
- Modify: `shared/tests/chainSolver.test.ts` (add tests for it)
- Modify: `server/src/rooms/Room.ts` (add round state)
- Modify: `server/tests/Room.test.ts` (add tests for it)
- Create: `server/src/socket/registerHostRoundHandlers.ts`
- Modify: `server/src/index.ts` (wire the new handler)
- Test: `server/tests/registerHostRoundHandlers.test.ts`

**Interfaces:**
- Consumes: `createChainState` (Task 3), `Puzzle` (Task 2), `validatePuzzleWords` (Task 5), `Room` (Task 7)
- Produces: `toPublicRows(words): PublicChainRow[]`, `RoundStartedPayload` type; `Room.startRound(puzzle)`, `Room.currentRound`, `Room.getEntrantId(socketId)`; event `"host:startRound"` payload `{ puzzle: Puzzle }`, ack `{ success: boolean; error?: string }`; broadcast `"round:started"` payload matching `RoundStartedPayload`. Consumed by Task 15 (submitGuess), Task 16 (hint), Task 17 (round end), Task 27/28 (client PlayerLobbyPage/PlayerRoundPage), Task 29 (client HostRoundPage).

- [ ] **Step 1: Add the failing shared test**

Append to `shared/tests/chainSolver.test.ts`:

```ts
import { toPublicRows } from "../src/chainSolver.js";

describe("toPublicRows", () => {
  it("exposes clue text for the first and last row, and only lengths for blanks", () => {
    const rows = toPublicRows(["HOT", "DOG", "KICK"]);
    expect(rows).toEqual([
      { index: 0, length: 3, isClue: true, text: "HOT" },
      { index: 1, length: 3, isClue: false },
      { index: 2, length: 4, isClue: true, text: "KICK" },
    ]);
  });
});
```

- [ ] **Step 2: Run the shared tests to verify the new one fails**

Run: `npm run test --workspace=shared`
Expected: FAIL — `toPublicRows is not exported`.

- [ ] **Step 3: Implement toPublicRows in chainSolver.ts**

Append to `shared/src/chainSolver.ts`:

```ts
export interface PublicChainRow {
  index: number;
  length: number;
  isClue: boolean;
  text?: string;
}

export function toPublicRows(words: string[]): PublicChainRow[] {
  return words.map((word, index) => {
    const isClue = index === 0 || index === words.length - 1;
    return isClue
      ? { index, length: word.length, isClue: true, text: word }
      : { index, length: word.length, isClue: false };
  });
}

export interface RoundStartedPayload {
  puzzleId: string;
  category: string;
  timeCapSeconds: number;
  rows: PublicChainRow[];
  startedAt: number;
  isLastRound: boolean;
}
```

`isLastRound` is declared by the host (who alone knows the playlist length) and simply relayed by the server — it lets a player's client show the special final-results treatment (Task 30) without needing to know the playlist itself.

- [ ] **Step 4: Run the shared tests to verify they pass**

Run: `npm run test --workspace=shared`
Expected: PASS.

- [ ] **Step 5: Add the failing Room tests**

Append to `server/tests/Room.test.ts`:

```ts
import type { Puzzle } from "@wordchain/shared";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("Room round state", () => {
  it("creates one chain state per individual player", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(2);
    expect(room.currentRound?.entrantChains.has("p1")).toBe(true);
  });

  it("creates one shared chain state per team in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.assignTeam("p1", "t1");
    room.assignTeam("p2", "t1");
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(1);
    expect(room.currentRound?.entrantChains.has("t1")).toBe(true);
  });

  it("skips team-mode players who have not picked a team yet", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex"); // no team assigned
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(0);
  });

  it("getEntrantId returns the socketId in individual mode and the teamId in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    expect(room.getEntrantId("p1")).toBe("p1");

    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.assignTeam("p1", "t1");
    expect(room.getEntrantId("p1")).toBe("t1");
  });
});
```

- [ ] **Step 6: Run the Room tests to verify the new ones fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `room.startRound is not a function`.

- [ ] **Step 7: Implement round state in Room.ts**

Modify `server/src/rooms/Room.ts` — update the import line and add the new interface/fields/methods:

```ts
// change the existing import line to:
import { createChainState, type ChainState, type GameMode, type PlayerInfo, type Puzzle, type TeamInfo } from "@wordchain/shared";
```

Add this interface above the `Room` class:

```ts
export interface RoundState {
  puzzle: Puzzle;
  startedAt: number;
  entrantChains: Map<string, ChainState>;
  finishedAt: Map<string, number>;
}
```

Add this field inside the `Room` class, alongside the existing `teams`/`mode` fields:

```ts
  currentRound: RoundState | null = null;
```

Add these two methods inside the `Room` class (after `getPlayers`):

```ts
  getEntrantId(socketId: string): string {
    const player = this.players.get(socketId);
    if (!player) throw new Error(`Player ${socketId} does not exist`);
    if (this.mode === "team") {
      if (!player.teamId) throw new Error(`Player ${socketId} has not selected a team`);
      return player.teamId;
    }
    return socketId;
  }

  startRound(puzzle: Puzzle): void {
    const entrantChains = new Map<string, ChainState>();
    for (const player of this.players.values()) {
      if (this.mode === "team" && !player.teamId) continue;
      const entrantId = this.getEntrantId(player.socketId);
      if (!entrantChains.has(entrantId)) {
        entrantChains.set(entrantId, createChainState(puzzle.words));
      }
    }
    this.currentRound = { puzzle, startedAt: Date.now(), entrantChains, finishedAt: new Map() };
  }
```

- [ ] **Step 8: Run the Room tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 9: Write the failing host:startRound test**

Create `server/tests/registerHostRoundHandlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import type { Puzzle } from "@wordchain/shared";
import { createServer } from "../src/index.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("host:startRound", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setupRoomWithHostAndPlayer() {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    return { url, code, host, player, roomManager };
  }

  it("starts the round and broadcasts public rows without solutions", async () => {
    const { code, host, player, roomManager } = await setupRoomWithHostAndPlayer();

    const roundStartedPromise = new Promise<{ rows: unknown[]; puzzleId: string }>((resolve) => {
      player.once("round:started", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:startRound", { puzzle: PUZZLE }, resolve);
    });

    expect(response.success).toBe(true);
    const payload = await roundStartedPromise;
    expect(payload.puzzleId).toBe("test-puzzle");
    expect(JSON.stringify(payload)).not.toContain("\"DOG\"");
    expect(roomManager.getRoom(code)?.currentRound?.puzzle.id).toBe("test-puzzle");
  });

  it("rejects host:startRound from a non-host socket", async () => {
    const { player } = await setupRoomWithHostAndPlayer();

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("host:startRound", { puzzle: PUZZLE }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/host/i);
  });

  it("rejects a structurally invalid puzzle", async () => {
    const { host } = await setupRoomWithHostAndPlayer();
    const invalidPuzzle: Puzzle = { ...PUZZLE, words: ["HOT"] };

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit("host:startRound", { puzzle: invalidPuzzle }, resolve);
    });

    expect(response.success).toBe(false);
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `host:startRound` never responds (timeout).

- [ ] **Step 11: Implement registerHostRoundHandlers.ts**

```ts
// server/src/socket/registerHostRoundHandlers.ts

import type { Server, Socket } from "socket.io";
import { toPublicRows, validatePuzzleWords, type Puzzle } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

export function registerHostRoundHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "host:startRound",
    (
      payload: { puzzle: Puzzle; isLastRound?: boolean },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can start a round" });
        return;
      }
      const errors = validatePuzzleWords(payload.puzzle.words);
      if (errors.length > 0) {
        callback({ success: false, error: errors[0].message });
        return;
      }

      room.startRound(payload.puzzle);

      io.to(room.code).emit("round:started", {
        puzzleId: payload.puzzle.id,
        category: payload.puzzle.category,
        timeCapSeconds: payload.puzzle.timeCapSeconds,
        rows: toPublicRows(payload.puzzle.words),
        startedAt: room.currentRound!.startedAt,
        isLastRound: payload.isLastRound ?? false,
      });
      callback({ success: true });
    }
  );
}
```

- [ ] **Step 12: Wire it into the server bootstrap**

Modify `server/src/index.ts`:

```ts
// add near the other imports
import { registerHostRoundHandlers } from "./socket/registerHostRoundHandlers.js";
```

Update the connection handler:

```ts
  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);
    registerHostRoundHandlers(io, socket, roomManager);
  });
```

- [ ] **Step 13: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add shared/src/chainSolver.ts shared/tests/chainSolver.test.ts server/src/rooms/Room.ts server/tests/Room.test.ts server/src/socket/registerHostRoundHandlers.ts server/src/index.ts server/tests/registerHostRoundHandlers.test.ts
git commit -m "Add round start with host-only enforcement and solution-free broadcast"
```

---

## Task 15: Submit guess (shared boards for team mode)

**Files:**
- Modify: `shared/src/chainSolver.ts` (add `toPublicBoardView`)
- Modify: `shared/tests/chainSolver.test.ts` (add tests for it)
- Create: `server/src/socket/registerRoundPlayHandlers.ts`
- Modify: `server/src/index.ts` (wire the new handler)
- Test: `server/tests/registerRoundPlayHandlers.test.ts`

**Interfaces:**
- Consumes: `submitGuess`/`isComplete` (Task 3), `Room.currentRound`/`getEntrantId` (Task 14)
- Produces: `toPublicBoardView(state): PublicBoardView`; event `"player:submitGuess"` payload `{ rowIndex: number; guess: string }`, ack `{ success: boolean; correct?: boolean; error?: string }`; broadcast `"board:updated"` payload `{ entrantId: string; view: PublicBoardView }`; broadcast `"player:chainComplete"` payload `{ entrantId: string }`. Consumed by Task 17 (round end scoring) and Task 28/29 (client round pages).

- [ ] **Step 1: Add the failing shared test**

Append to `shared/tests/chainSolver.test.ts`:

```ts
import { toPublicBoardView } from "../src/chainSolver.js";

describe("toPublicBoardView", () => {
  it("reveals full text for solved rows and a hinted prefix for active rows", () => {
    let state = createChainState(["HOT", "DOG", "TAG", "KICK"]);
    state = submitGuess(state, 1, "DOG").state; // topSolved -> 1
    state = applyHint(state, 2); // reveal 1 letter of TAG

    const view = toPublicBoardView(state);
    expect(view.revealedText[0]).toBe("HOT"); // clue
    expect(view.revealedText[1]).toBe("DOG"); // solved
    expect(view.revealedText[2]).toBe("T"); // hinted prefix only
    expect(view.revealedText[3]).toBe("KICK"); // clue
    expect(view.penaltySeconds).toBe(5);
  });

  it("reveals nothing for an untouched middle row", () => {
    const state = createChainState(["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"]);
    const view = toPublicBoardView(state);
    expect(view.revealedText[2]).toBeUndefined();
    expect(view.revealedText[3]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the shared tests to verify the new ones fail**

Run: `npm run test --workspace=shared`
Expected: FAIL — `toPublicBoardView is not exported`.

- [ ] **Step 3: Implement toPublicBoardView in chainSolver.ts**

Append to `shared/src/chainSolver.ts`:

```ts
export interface PublicBoardView {
  topSolved: number;
  bottomSolved: number;
  revealedText: Record<number, string>;
  penaltySeconds: number;
}

export function toPublicBoardView(state: ChainState): PublicBoardView {
  const revealedText: Record<number, string> = {};
  state.words.forEach((word, index) => {
    if (index <= state.topSolved || index >= state.bottomSolved) {
      revealedText[index] = word;
      return;
    }
    const revealedCount = state.revealedLetters[index];
    if (revealedCount > 0) {
      revealedText[index] = word.slice(0, revealedCount);
    }
  });
  return {
    topSolved: state.topSolved,
    bottomSolved: state.bottomSolved,
    revealedText,
    penaltySeconds: state.penaltySeconds,
  };
}
```

- [ ] **Step 4: Run the shared tests to verify they pass**

Run: `npm run test --workspace=shared`
Expected: PASS.

- [ ] **Step 5: Write the failing server tests**

Create `server/tests/registerRoundPlayHandlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import type { Puzzle } from "@wordchain/shared";
import { createServer } from "../src/index.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("player:submitGuess", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setupActiveRound(mode: "individual" | "team" = "individual") {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const createPayload =
      mode === "team" ? { mode, teams: [{ id: "t1", name: "Red Team" }] } : { mode };
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", createPayload, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    let teammate: Socket | undefined;
    if (mode === "team") {
      await new Promise<void>((resolve) => player.emit("player:selectTeam", { teamId: "t1" }, () => resolve()));
      teammate = ioClient(url);
      await new Promise<void>((resolve) => teammate!.on("connect", resolve));
      await new Promise<void>((resolve) =>
        teammate!.emit("player:joinRoom", { code, nickname: "Sam" }, () => resolve())
      );
      await new Promise<void>((resolve) => teammate!.emit("player:selectTeam", { teamId: "t1" }, () => resolve()));
    }

    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      teammate?.close();
      io.close();
      httpServer.close();
    };

    return { host, player, teammate, roomManager, code };
  }

  it("accepts a correct guess and broadcasts the updated board", async () => {
    const { player } = await setupActiveRound();

    const updatePromise = new Promise<{ entrantId: string; view: { topSolved: number } }>((resolve) => {
      player.once("board:updated", resolve);
    });
    const response = await new Promise<{ success: boolean; correct: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 1, guess: "dog" }, resolve);
    });

    expect(response).toEqual({ success: true, correct: true });
    expect((await updatePromise).view.topSolved).toBe(1);
  });

  it("penalizes a wrong guess without advancing the pointer", async () => {
    const { player } = await setupActiveRound();

    const updatePromise = new Promise<{ view: { topSolved: number; penaltySeconds: number } }>((resolve) => {
      player.once("board:updated", resolve);
    });
    const response = await new Promise<{ correct: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 1, guess: "CAT" }, resolve);
    });

    expect(response.correct).toBe(false);
    const update = await updatePromise;
    expect(update.view.topSolved).toBe(0);
    expect(update.view.penaltySeconds).toBe(3);
  });

  it("emits player:chainComplete once the last row is solved", async () => {
    const { player } = await setupActiveRound();

    const completePromise = new Promise<{ entrantId: string }>((resolve) => {
      player.once("player:chainComplete", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    expect((await completePromise).entrantId).toBe(player.id);
  });

  it("rejects a guess on a row that is not active", async () => {
    const { player } = await setupActiveRound();
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 0, guess: "HOT" }, resolve);
    });
    expect(response.success).toBe(false);
  });

  it("shares one board across teammates", async () => {
    const { player, teammate } = await setupActiveRound("team");

    const teammateUpdatePromise = new Promise<{ view: { topSolved: number } }>((resolve) => {
      teammate!.once("board:updated", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    expect((await teammateUpdatePromise).view.topSolved).toBe(1);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `player:submitGuess` never responds (timeout).

- [ ] **Step 7: Implement registerRoundPlayHandlers.ts**

```ts
// server/src/socket/registerRoundPlayHandlers.ts

import type { Server, Socket } from "socket.io";
import { isComplete, submitGuess, toPublicBoardView } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { Room } from "../rooms/Room.js";

function resolveActiveRoom(socket: Socket, roomManager: RoomManager): Room | undefined {
  const roomCode = socket.data.roomCode as string | undefined;
  const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
  return room?.currentRound ? room : undefined;
}

export function registerRoundPlayHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "player:submitGuess",
    (
      payload: { rowIndex: number; guess: string },
      callback: (response: { success: boolean; correct?: boolean; error?: string }) => void
    ) => {
      const room = resolveActiveRoom(socket, roomManager);
      if (!room) {
        callback({ success: false, error: "No active round" });
        return;
      }
      let entrantId: string;
      try {
        entrantId = room.getEntrantId(socket.id);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const chainState = room.currentRound!.entrantChains.get(entrantId);
      if (!chainState) {
        callback({ success: false, error: "No board found for this player" });
        return;
      }

      let result;
      try {
        result = submitGuess(chainState, payload.rowIndex, payload.guess);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }

      room.currentRound!.entrantChains.set(entrantId, result.state);
      io.to(room.code).emit("board:updated", { entrantId, view: toPublicBoardView(result.state) });

      if (result.correct && isComplete(result.state) && !room.currentRound!.finishedAt.has(entrantId)) {
        room.currentRound!.finishedAt.set(entrantId, Date.now());
        io.to(room.code).emit("player:chainComplete", { entrantId });
      }

      callback({ success: true, correct: result.correct });
    }
  );
}
```

- [ ] **Step 8: Wire it into the server bootstrap**

Modify `server/src/index.ts`:

```ts
// add near the other imports
import { registerRoundPlayHandlers } from "./socket/registerRoundPlayHandlers.js";
```

Update the connection handler:

```ts
  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);
    registerHostRoundHandlers(io, socket, roomManager);
    registerRoundPlayHandlers(io, socket, roomManager);
  });
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add shared/src/chainSolver.ts shared/tests/chainSolver.test.ts server/src/socket/registerRoundPlayHandlers.ts server/src/index.ts server/tests/registerRoundPlayHandlers.test.ts
git commit -m "Add player:submitGuess handler with shared team boards and tests"
```

---

## Task 16: Use hint

**Files:**
- Modify: `server/src/socket/registerRoundPlayHandlers.ts` (add a second handler, reusing `resolveActiveRoom`)
- Modify: `server/tests/registerRoundPlayHandlers.test.ts` (add tests)

**Interfaces:**
- Consumes: `applyHint` (Task 3), `resolveActiveRoom` (Task 15, same file)
- Produces: event `"player:useHint"` payload `{ rowIndex: number }`, ack `{ success: boolean; error?: string }`; reuses the `"board:updated"` broadcast from Task 15. Consumed by Task 28 (client PlayerRoundPage hint button).

- [ ] **Step 1: Add the failing tests**

Append to `server/tests/registerRoundPlayHandlers.test.ts`, as a new `describe` block after `player:submitGuess`:

```ts
describe("player:useHint", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setupActiveRound() {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));
    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    return { player };
  }

  it("reveals the next letter and applies the hint penalty", async () => {
    const { player } = await setupActiveRound();

    const updatePromise = new Promise<{ view: { revealedText: Record<number, string>; penaltySeconds: number } }>(
      (resolve) => player.once("board:updated", resolve)
    );
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:useHint", { rowIndex: 1 }, resolve);
    });

    expect(response.success).toBe(true);
    const update = await updatePromise;
    expect(update.view.revealedText[1]).toBe("D");
    expect(update.view.penaltySeconds).toBe(5);
  });

  it("rejects a hint on a row that is not active", async () => {
    const { player } = await setupActiveRound();
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:useHint", { rowIndex: 0 }, resolve);
    });
    expect(response.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `player:useHint` never responds (timeout).

- [ ] **Step 3: Add the handler to registerRoundPlayHandlers.ts**

Update the import line at the top of `server/src/socket/registerRoundPlayHandlers.ts`:

```ts
import { applyHint, isComplete, submitGuess, toPublicBoardView } from "@wordchain/shared";
```

Add this inside `registerRoundPlayHandlers`, after the `player:submitGuess` handler:

```ts
  socket.on(
    "player:useHint",
    (payload: { rowIndex: number }, callback: (response: { success: boolean; error?: string }) => void) => {
      const room = resolveActiveRoom(socket, roomManager);
      if (!room) {
        callback({ success: false, error: "No active round" });
        return;
      }
      let entrantId: string;
      try {
        entrantId = room.getEntrantId(socket.id);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const chainState = room.currentRound!.entrantChains.get(entrantId);
      if (!chainState) {
        callback({ success: false, error: "No board found for this player" });
        return;
      }

      let nextState;
      try {
        nextState = applyHint(chainState, payload.rowIndex);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }

      room.currentRound!.entrantChains.set(entrantId, nextState);
      io.to(room.code).emit("board:updated", { entrantId, view: toPublicBoardView(nextState) });
      callback({ success: true });
    }
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/socket/registerRoundPlayHandlers.ts server/tests/registerRoundPlayHandlers.test.ts
git commit -m "Add player:useHint handler with tests"
```

---

## Task 17: Round end and scoring

Ends a round either when the host forces it or when the puzzle's time cap elapses, scores every entrant, accumulates points across the room's playlist, and clears the round.

**Files:**
- Modify: `server/src/rooms/Room.ts` (add `totalPoints` and `getDisplayName`)
- Modify: `server/tests/Room.test.ts` (add a test for `getDisplayName`)
- Create: `server/src/rooms/scoreRound.ts`
- Test: `server/tests/scoreRound.test.ts`
- Modify: `server/src/socket/registerHostRoundHandlers.ts` (schedule the auto-timer, add `host:endRound`)
- Test: `server/tests/registerHostRoundHandlers.test.ts` (add tests)

**Interfaces:**
- Consumes: `computeFinisherPoints`/`computeNonFinisherPoints` (Task 4), `RoundResult` type (Task 2), `Room.currentRound` (Task 14)
- Produces: `Room.totalPoints: Map<string, number>`, `Room.getDisplayName(entrantId): string`; `computeRoundResults(room): RoundResult[]`; `endRound(io, room): void`; event `"host:endRound"` ack `{ success: boolean; error?: string }`; broadcast `"round:results"` payload `{ results: RoundResult[]; totals: Record<string, number> }`. Consumed by Task 30/31 (client results pages).

- [ ] **Step 1: Add the failing Room test**

Append to `server/tests/Room.test.ts`:

```ts
describe("Room.getDisplayName", () => {
  it("returns the player's nickname in individual mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    expect(room.getDisplayName("p1")).toBe("Alex");
  });

  it("returns the team name in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.assignTeam("p1", "t1");
    expect(room.getDisplayName("t1")).toBe("Red Team");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `room.getDisplayName is not a function`.

- [ ] **Step 3: Add totalPoints and getDisplayName to Room.ts**

Add this field inside the `Room` class, next to `currentRound`:

```ts
  totalPoints: Map<string, number> = new Map();
```

Add this method inside the `Room` class:

```ts
  getDisplayName(entrantId: string): string {
    if (this.mode === "team") {
      const team = this.teams.find((t) => t.id === entrantId);
      if (team) return team.name;
    }
    const player = this.players.get(entrantId);
    return player?.nickname ?? entrantId;
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Write the failing scoreRound tests**

Create `server/tests/scoreRound.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Puzzle } from "@wordchain/shared";
import { createChainState, submitGuess } from "@wordchain/shared";
import { Room } from "../src/rooms/Room.js";
import { computeRoundResults } from "../src/rooms/scoreRound.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "TAG", "KICK"],
  timeCapSeconds: 60,
};

describe("computeRoundResults", () => {
  it("scores a finisher at 1000 points when they are the only finisher", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.startRound(PUZZLE);
    room.currentRound!.startedAt = Date.now() - 10_000; // 10s ago
    room.currentRound!.finishedAt.set("p1", Date.now());

    const results = computeRoundResults(room);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ entrantId: "p1", finished: true, points: 1000 });
  });

  it("gives a non-finisher partial credit based on blanks solved", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.startRound(PUZZLE); // words: HOT, DOG, TAG, KICK -> 2 blanks total
    let state = room.currentRound!.entrantChains.get("p1")!;
    state = submitGuess(state, 1, "DOG").state; // solves 1 of 2 blanks
    room.currentRound!.entrantChains.set("p1", state);
    // no finishedAt entry -> non-finisher

    const results = computeRoundResults(room);
    expect(results[0]).toMatchObject({ finished: false, rowsSolved: 1, totalRows: 2, points: 100 });
  });

  it("scores a slower second finisher proportionally against the fastest", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.startRound(PUZZLE);
    const now = Date.now();
    room.currentRound!.startedAt = now - 60_000;
    room.currentRound!.finishedAt.set("p1", now - 30_000); // took 30s
    room.currentRound!.finishedAt.set("p2", now); // took 60s

    const results = computeRoundResults(room);
    const p1 = results.find((r) => r.entrantId === "p1")!;
    const p2 = results.find((r) => r.entrantId === "p2")!;
    expect(p1.points).toBe(1000);
    expect(p2.points).toBe(500); // 1000 * 30/60
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `Cannot find module '../src/rooms/scoreRound.js'`

- [ ] **Step 7: Implement scoreRound.ts**

```ts
// server/src/rooms/scoreRound.ts

import type { Server } from "socket.io";
import { computeFinisherPoints, computeNonFinisherPoints, type RoundResult } from "@wordchain/shared";
import type { Room } from "./Room.js";

export function computeRoundResults(room: Room): RoundResult[] {
  const round = room.currentRound;
  if (!round) throw new Error("No active round to score");

  const totalBlanks = round.puzzle.words.length - 2;
  const rawTimes = new Map<string, number>();
  for (const [entrantId, finishedAtMs] of round.finishedAt.entries()) {
    const chainState = round.entrantChains.get(entrantId)!;
    const elapsedSeconds = (finishedAtMs - round.startedAt) / 1000;
    rawTimes.set(entrantId, elapsedSeconds + chainState.penaltySeconds);
  }
  const fastestTime = rawTimes.size > 0 ? Math.min(...rawTimes.values()) : null;

  return [...round.entrantChains.keys()].map((entrantId) => {
    const chainState = round.entrantChains.get(entrantId)!;
    const displayName = room.getDisplayName(entrantId);

    if (rawTimes.has(entrantId)) {
      const rawTimeSeconds = rawTimes.get(entrantId)!;
      return {
        entrantId,
        displayName,
        finished: true,
        rowsSolved: totalBlanks,
        totalRows: totalBlanks,
        rawTimeSeconds,
        points: computeFinisherPoints(rawTimeSeconds, fastestTime!),
      };
    }

    const blanksSolved = chainState.topSolved + (round.puzzle.words.length - 1 - chainState.bottomSolved);
    return {
      entrantId,
      displayName,
      finished: false,
      rowsSolved: blanksSolved,
      totalRows: totalBlanks,
      rawTimeSeconds: null,
      points: computeNonFinisherPoints(blanksSolved, totalBlanks),
    };
  });
}

export function endRound(io: Server, room: Room): void {
  if (!room.currentRound) return; // already ended (manual end raced with the auto-timer)

  const results = computeRoundResults(room);
  for (const result of results) {
    const previous = room.totalPoints.get(result.entrantId) ?? 0;
    room.totalPoints.set(result.entrantId, previous + result.points);
  }

  io.to(room.code).emit("round:results", {
    results,
    totals: Object.fromEntries(room.totalPoints),
  });

  room.currentRound = null;
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 9: Write the failing host:endRound + auto-timer tests**

Append to `server/tests/registerHostRoundHandlers.test.ts`:

```ts
describe("round ending", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("ends the round on host:endRound and broadcasts results", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));
    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const resultsPromise = new Promise<{ results: unknown[] }>((resolve) => {
      player.once("round:results", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:endRound", {}, resolve);
    });

    expect(response.success).toBe(true);
    expect((await resultsPromise).results).toHaveLength(1);
  });

  it("automatically ends the round when the time cap elapses", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const resultsPromise = new Promise<{ results: unknown[] }>((resolve) => {
      player.once("round:results", resolve);
    });
    await new Promise<void>((resolve) =>
      host.emit("host:startRound", { puzzle: { ...PUZZLE, timeCapSeconds: 0.2 } }, () => resolve())
    );

    const results = await resultsPromise; // should arrive on its own within ~200ms, no manual end
    expect(results.results).toHaveLength(1);
  }, 2000);
});
```

- [ ] **Step 10: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `host:endRound` never responds, and no automatic `round:results` arrives.

- [ ] **Step 11: Add the auto-timer and host:endRound handler**

Update the import line at the top of `server/src/socket/registerHostRoundHandlers.ts`:

```ts
import { toPublicRows, validatePuzzleWords, type Puzzle } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";
import { endRound } from "../rooms/scoreRound.js";
```

Inside the `host:startRound` handler, replace the block from `room.startRound(payload.puzzle);` through the `io.to(room.code).emit(...)` call with:

```ts
      room.startRound(payload.puzzle);

      io.to(room.code).emit("round:started", {
        puzzleId: payload.puzzle.id,
        category: payload.puzzle.category,
        timeCapSeconds: payload.puzzle.timeCapSeconds,
        rows: toPublicRows(payload.puzzle.words),
        startedAt: room.currentRound!.startedAt,
      });

      setTimeout(() => endRound(io, room), payload.puzzle.timeCapSeconds * 1000);
```

Add a second handler inside `registerHostRoundHandlers`, after the `host:startRound` handler:

```ts
  socket.on(
    "host:endRound",
    (_payload: Record<string, never>, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can end a round" });
        return;
      }
      endRound(io, room);
      callback({ success: true });
    }
  );
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add server/src/rooms/Room.ts server/tests/Room.test.ts server/src/rooms/scoreRound.ts server/tests/scoreRound.test.ts server/src/socket/registerHostRoundHandlers.ts server/tests/registerHostRoundHandlers.test.ts
git commit -m "Add round-end scoring with auto-timer and host override"
```

---

## Task 18: Kick player, presence, and reconnect

**Files:**
- Modify: `server/src/rooms/Room.ts` (add `reconnectPlayer`)
- Modify: `server/tests/Room.test.ts` (add tests)
- Modify: `server/src/socket/registerHostHandlers.ts` (add `host:kickPlayer`)
- Modify: `server/src/socket/registerPlayerHandlers.ts` (try reconnect before creating a new player)
- Create: `server/src/socket/registerPresenceHandlers.ts`
- Modify: `server/src/index.ts` (accept options, wire presence handler)
- Test: `server/tests/registerHostHandlers.test.ts`, `server/tests/registerPlayerHandlers.test.ts`, `server/tests/registerPresenceHandlers.test.ts`

**Interfaces:**
- Consumes: `Room` (Task 7), `socket.data.roomCode` convention (Task 12)
- Produces: `Room.reconnectPlayer(nickname, newSocketId): PlayerInfo | null`; event `"host:kickPlayer"` payload `{ socketId: string }`; broadcast `"room:playerLeft"` payload `{ socketId: string }`; `createServer(options?: { presenceGracePeriodMs?: number })`. Consumed by Task 27 (client host lobby kick button) and the reconnect flow implied by the design spec.

- [ ] **Step 1: Add the failing Room test**

Append to `server/tests/Room.test.ts`:

```ts
describe("Room.reconnectPlayer", () => {
  it("returns null when no disconnected player matches the nickname", () => {
    const room = new Room("BLUE-42", "host-1");
    expect(room.reconnectPlayer("Alex", "new-socket")).toBeNull();
  });

  it("re-associates a disconnected player under the new socket id", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex");
    room.setConnected("old-socket", false);

    const reconnected = room.reconnectPlayer("Alex", "new-socket");
    expect(reconnected).toMatchObject({ socketId: "new-socket", nickname: "Alex", connected: true });
    expect(room.getPlayers()).toHaveLength(1);
  });

  it("migrates an in-progress individual chain state to the new socket id", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex");
    room.startRound({ id: "p", category: "c", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 });
    room.setConnected("old-socket", false);

    room.reconnectPlayer("Alex", "new-socket");
    expect(room.currentRound?.entrantChains.has("new-socket")).toBe(true);
    expect(room.currentRound?.entrantChains.has("old-socket")).toBe(false);
  });

  it("does not reconnect a player who is still connected", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex"); // still connected: true
    expect(room.reconnectPlayer("Alex", "new-socket")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `room.reconnectPlayer is not a function`.

- [ ] **Step 3: Implement reconnectPlayer in Room.ts**

Add this method inside the `Room` class:

```ts
  reconnectPlayer(nickname: string, newSocketId: string): PlayerInfo | null {
    const existingEntry = [...this.players.entries()].find(
      ([, p]) => p.nickname === nickname && !p.connected
    );
    if (!existingEntry) return null;

    const [oldSocketId, oldPlayer] = existingEntry;
    this.players.delete(oldSocketId);
    const reconnected: PlayerInfo = { ...oldPlayer, socketId: newSocketId, connected: true };
    this.players.set(newSocketId, reconnected);

    if (this.currentRound) {
      const chainState = this.currentRound.entrantChains.get(oldSocketId);
      if (chainState) {
        this.currentRound.entrantChains.delete(oldSocketId);
        this.currentRound.entrantChains.set(newSocketId, chainState);
      }
      if (this.currentRound.finishedAt.has(oldSocketId)) {
        const finishedAtMs = this.currentRound.finishedAt.get(oldSocketId)!;
        this.currentRound.finishedAt.delete(oldSocketId);
        this.currentRound.finishedAt.set(newSocketId, finishedAtMs);
      }
    }

    return reconnected;
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Make player:joinRoom attempt a reconnect first**

In `server/src/socket/registerPlayerHandlers.ts`, replace the body of the `player:joinRoom` handler:

```ts
      const room = roomManager.getRoom(payload.code);
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }

      const reconnected = room.reconnectPlayer(payload.nickname, socket.id);
      if (reconnected) {
        socket.join(room.code);
        socket.data.roomCode = room.code;
        io.to(room.code).emit("room:playerUpdated", reconnected);
        callback({ success: true, mode: room.mode, teams: room.teams });
        return;
      }

      const player = room.addPlayer(socket.id, payload.nickname);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.to(room.code).emit("room:playerJoined", player);
      callback({ success: true, mode: room.mode, teams: room.teams });
```

Add a test for this to `server/tests/registerPlayerHandlers.test.ts` (new `it` inside the existing `describe("player:joinRoom", ...)` block):

```ts
  it("reconnects a disconnected player instead of creating a duplicate", async () => {
    const { url, code, roomManager } = await setup();
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve())
    );
    firstConnection.close();
    await new Promise((resolve) => setTimeout(resolve, 50)); // let the server register the disconnect
    roomManager.getRoom(code)!.setConnected(
      roomManager.getRoom(code)!.getPlayers()[0].socketId,
      false
    );

    const secondConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => secondConnection.on("connect", resolve));
    const response = await new Promise<{ success: boolean }>((resolve) => {
      secondConnection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(true);
    expect(roomManager.getRoom(code)?.getPlayers()).toHaveLength(1);
    secondConnection.close();
  });
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 7: Write the failing host:kickPlayer test**

Append to `server/tests/registerHostHandlers.test.ts`:

```ts
describe("host:kickPlayer", () => {
  it("removes the player and broadcasts room:playerLeft", async () => {
    const { client: host, roomManager } = await connectClient();
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const room = roomManager.getRoom(code)!;
    room.addPlayer("fake-player-socket", "Troll");

    const leftPromise = new Promise<{ socketId: string }>((resolve) => host.once("room:playerLeft", resolve));
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:kickPlayer", { socketId: "fake-player-socket" }, resolve);
    });

    expect(response.success).toBe(true);
    expect((await leftPromise).socketId).toBe("fake-player-socket");
    expect(room.getPlayers()).toHaveLength(0);
  });

  it("rejects a kick from a non-host socket", async () => {
    const { client: host } = await connectClient();
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const impostor = ioClient((host.io as unknown as { uri: string }).uri);
    await new Promise<void>((resolve) => impostor.on("connect", resolve));
    impostor.emit("player:joinRoom", { code, nickname: "Alex" }, () => {});
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      impostor.emit("host:kickPlayer", { socketId: "someone" }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/host/i);
    impostor.close();
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `host:kickPlayer` never responds (timeout).

- [ ] **Step 9: Add host:kickPlayer to registerHostHandlers.ts**

Add this inside `registerHostHandlers`, after the `host:createRoom` handler:

```ts
  socket.on(
    "host:kickPlayer",
    (payload: { socketId: string }, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can kick players" });
        return;
      }
      room.removePlayer(payload.socketId);
      io.to(room.code).emit("room:playerLeft", { socketId: payload.socketId });
      io.sockets.sockets.get(payload.socketId)?.disconnect(true);
      callback({ success: true });
    }
  );
```

- [ ] **Step 10: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 11: Write the failing presence test**

Create `server/tests/registerPresenceHandlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("presence on disconnect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("marks a player disconnected (not removed) immediately, then removes them after the grace period", async () => {
    const { httpServer, io } = createServer({ presenceGracePeriodMs: 100 });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      io.close();
      httpServer.close();
    };

    const updatedPromise = new Promise<{ connected: boolean }>((resolve) => {
      host.once("room:playerUpdated", resolve);
    });
    const leftPromise = new Promise<{ socketId: string }>((resolve) => {
      host.once("room:playerLeft", resolve);
    });

    player.close();

    expect((await updatedPromise).connected).toBe(false);
    await leftPromise; // resolves once the grace period elapses
  }, 2000);
});
```

- [ ] **Step 12: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `createServer` does not accept options / no presence handling registered.

- [ ] **Step 13: Implement registerPresenceHandlers.ts**

```ts
// server/src/socket/registerPresenceHandlers.ts

import type { Server, Socket } from "socket.io";
import type { RoomManager } from "../rooms/RoomManager.js";

export function registerPresenceHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  gracePeriodMs: number
): void {
  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode as string | undefined;
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room || room.hostSocketId === socket.id) return;

    room.setConnected(socket.id, false);
    const player = room.getPlayers().find((p) => p.socketId === socket.id);
    if (player) io.to(room.code).emit("room:playerUpdated", player);

    setTimeout(() => {
      const stillThere = room.getPlayers().find((p) => p.socketId === socket.id);
      if (stillThere && !stillThere.connected) {
        room.removePlayer(socket.id);
        io.to(room.code).emit("room:playerLeft", { socketId: socket.id });
      }
    }, gracePeriodMs);
  });
}
```

- [ ] **Step 14: Wire it into the server bootstrap with a configurable grace period**

Modify `server/src/index.ts`. Update the import section and `createServer` signature:

```ts
import { registerPresenceHandlers } from "./socket/registerPresenceHandlers.js";

const DEFAULT_PRESENCE_GRACE_PERIOD_MS = 60_000;

export function createServer(options?: { presenceGracePeriodMs?: number }) {
  const presenceGracePeriodMs = options?.presenceGracePeriodMs ?? DEFAULT_PRESENCE_GRACE_PERIOD_MS;
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  const roomManager = new RoomManager();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);
    registerHostRoundHandlers(io, socket, roomManager);
    registerRoundPlayHandlers(io, socket, roomManager);
    registerPresenceHandlers(io, socket, roomManager, presenceGracePeriodMs);
  });

  return { app, httpServer, io, roomManager };
}
```

(This replaces the whole `createServer` function body and the `io.on("connection", ...)` block added across Tasks 11, 12, 14, and 15 — the rest of the file, including the `if (import.meta.url === ...)` startup block below it, is unchanged.)

- [ ] **Step 15: Run all server tests to verify everything passes**

Run: `npm run test --workspace=server`
Expected: PASS — every server test file green, including the presence test.

- [ ] **Step 16: Commit**

```bash
git add server/src/rooms/Room.ts server/tests/Room.test.ts server/src/socket/registerHostHandlers.ts server/tests/registerHostHandlers.test.ts server/src/socket/registerPlayerHandlers.ts server/tests/registerPlayerHandlers.test.ts server/src/socket/registerPresenceHandlers.ts server/tests/registerPresenceHandlers.test.ts server/src/index.ts
git commit -m "Add host kick, presence tracking, and reconnect with chain-state migration"
```

---

**This completes the server. The next tasks build the client.**

---

## Task 19: Client scaffold — Tailwind theme and app shell

**Files:**
- Modify: `client/tailwind.config.js`
- Modify: `client/src/index.css` (or `App.css`, whichever the Vite template generated — replace its contents)
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind color tokens `chain-purple`, `chain-pink`, `chain-yellow`, `chain-yellow-shadow`, `chain-green`, `chain-locked`; a `<App />` shell rendering a gradient background. Consumed by every later client page/component task.

- [ ] **Step 1: Configure Tailwind**

Run (if not already done by the Vite scaffold in Task 1):

```bash
cd client && npx tailwindcss init -p
```

Replace `client/tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "chain-purple": "#6C5CE7",
        "chain-pink": "#FF6B9D",
        "chain-yellow": "#FFD93D",
        "chain-yellow-shadow": "#e0b800",
        "chain-green": "#4CD964",
        "chain-locked": "#2d2d3a",
      },
      fontFamily: {
        display: ["Baloo 2", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Add Tailwind directives**

Replace the contents of `client/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply font-body;
}
```

- [ ] **Step 3: Replace App.tsx with a minimal shell**

```tsx
// client/src/App.tsx

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center">
      <h1 className="font-display text-4xl text-white font-extrabold">Word Chain</h1>
    </div>
  );
}
```

- [ ] **Step 4: Confirm main.tsx imports the stylesheet**

`client/src/main.tsx` (from the Vite template) should already import `./index.css` — verify it does; if the template used `App.css` instead, change the import to `./index.css`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev --workspace=client`
Open the printed local URL in a browser.
Expected: a full-viewport purple-to-pink gradient with "Word Chain" in bold white text, centered.

- [ ] **Step 6: Commit**

```bash
git add client/tailwind.config.js client/src/index.css client/src/App.tsx client/src/main.tsx
git commit -m "Set up Tailwind theme and app shell"
```

---

## Task 20: Client socket wrapper

**Files:**
- Create: `client/src/socket.ts`
- Test: `client/tests/socket.test.ts`
- Modify: `client/vite.config.ts` (add Vitest config block)
- Create: `client/vitest.setup.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `getSocket(): Socket` (lazily creates and memoizes a single `socket.io-client` connection) — consumed by every page task (24-29).

- [ ] **Step 1: Add Vitest config to vite.config.ts**

Add a `test` block to the existing `defineConfig({...})` call in `client/vite.config.ts` (merge with whatever the Vite template already has, e.g. the `plugins` array):

```ts
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
```

- [ ] **Step 2: Create the test setup file**

```ts
// client/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Write the failing test**

Create `client/tests/socket.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSocket = { id: "mock-socket" };
const ioMock = vi.fn(() => mockSocket);
vi.mock("socket.io-client", () => ({ io: ioMock }));

describe("getSocket", () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockClear();
  });

  it("creates exactly one socket connection across repeated calls", async () => {
    const { getSocket } = await import("../src/socket.js");
    const first = getSocket();
    const second = getSocket();
    expect(first).toBe(second);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/socket.js'`

- [ ] **Step 5: Implement socket.ts**

```ts
// client/src/socket.ts

import { io, type Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL);
  }
  return socket;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/vite.config.ts client/vitest.setup.ts client/src/socket.ts client/tests/socket.test.ts
git commit -m "Add typed socket.io-client wrapper with Vitest setup"
```

---

## Task 21: Sound feedback utility

Uses the Web Audio API to synthesize short tones — no external audio asset files required.

**Files:**
- Create: `client/src/sound.ts`
- Test: `client/tests/sound.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `playTone(kind: "correct" | "wrong" | "complete"): void`, `isSoundEnabled(): boolean`, `setSoundEnabled(enabled: boolean): void` (persisted to `localStorage`). Consumed by Task 28 (client PlayerRoundPage).

- [ ] **Step 1: Write the failing tests**

Create `client/tests/sound.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { playTone, isSoundEnabled, setSoundEnabled } from "../src/sound.js";

describe("sound settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to enabled", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("persists the enabled flag across reads", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe("playTone", () => {
  function installAudioContextMock() {
    const oscillator = {
      type: "sine",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gainNode = { connect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gainNode),
      destination: {},
      currentTime: 0,
      close: vi.fn(),
    };
    // @ts-expect-error test double, not a full AudioContext
    globalThis.AudioContext = vi.fn(() => audioContext);
    return { audioContext, oscillator };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("plays a tone when sound is enabled", () => {
    const { oscillator } = installAudioContextMock();
    setSoundEnabled(true);
    playTone("correct");
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it("does nothing when sound is disabled", () => {
    const { oscillator } = installAudioContextMock();
    setSoundEnabled(false);
    playTone("correct");
    expect(oscillator.start).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/sound.js'`

- [ ] **Step 3: Implement sound.ts**

```ts
// client/src/sound.ts

const STORAGE_KEY = "wordchain:soundEnabled";

const TONE_FREQUENCIES: Record<"correct" | "wrong" | "complete", number> = {
  correct: 660,
  wrong: 220,
  complete: 880,
};

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function playTone(kind: "correct" | "wrong" | "complete"): void {
  if (!isSoundEnabled()) return;

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = TONE_FREQUENCIES[kind];
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.15);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/sound.ts client/tests/sound.test.ts
git commit -m "Add Web Audio API sound feedback utility with tests"
```

---

## Task 22: LetterCell and ChainRow components

**Files:**
- Create: `client/src/components/LetterCell.tsx`
- Create: `client/src/components/ChainRow.tsx`
- Test: `client/tests/LetterCell.test.tsx`
- Test: `client/tests/ChainRow.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `LetterCell` (props: `letter?: string`, `state: LetterCellState`), `LetterCellState = "locked" | "solved" | "hinted" | "typing" | "empty"`, `ChainRow` (props: `cells: ChainCellData[]`, `showHintButton: boolean`, `onHintClick?: () => void`), `ChainCellData = { letter?: string; state: LetterCellState }`. Consumed by Task 23 (`ChainBoard`).

- [ ] **Step 1: Write the failing LetterCell test**

Create `client/tests/LetterCell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LetterCell } from "../src/components/LetterCell.js";

describe("LetterCell", () => {
  it("renders the given letter", () => {
    render(<LetterCell letter="D" state="solved" />);
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("exposes its state via a data attribute for styling/testing", () => {
    render(<LetterCell letter="D" state="hinted" />);
    expect(screen.getByTestId("letter-cell")).toHaveAttribute("data-state", "hinted");
  });

  it("renders empty when no letter is given", () => {
    render(<LetterCell state="empty" />);
    expect(screen.getByTestId("letter-cell")).toHaveTextContent("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/components/LetterCell.js'`

- [ ] **Step 3: Implement LetterCell.tsx**

```tsx
// client/src/components/LetterCell.tsx

export type LetterCellState = "locked" | "solved" | "hinted" | "typing" | "empty";

export interface LetterCellProps {
  letter?: string;
  state: LetterCellState;
}

const STATE_CLASSES: Record<LetterCellState, string> = {
  locked: "bg-chain-locked text-white",
  solved: "bg-chain-green text-white",
  hinted: "bg-chain-yellow text-chain-locked shadow-[0_3px_0_#e0b800]",
  typing: "bg-white text-chain-purple border-2 border-dashed border-chain-purple",
  empty: "bg-white/40 border-2 border-dashed border-white/70",
};

export function LetterCell({ letter, state }: LetterCellProps) {
  return (
    <div
      data-testid="letter-cell"
      data-state={state}
      className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-black text-lg uppercase ${STATE_CLASSES[state]}`}
    >
      {letter ?? ""}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Write the failing ChainRow test**

Create `client/tests/ChainRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChainRow, type ChainCellData } from "../src/components/ChainRow.js";

const CELLS: ChainCellData[] = [
  { letter: "D", state: "solved" },
  { letter: undefined, state: "empty" },
  { letter: undefined, state: "empty" },
];

describe("ChainRow", () => {
  it("renders one LetterCell per cell in the row", () => {
    render(<ChainRow cells={CELLS} showHintButton={false} />);
    expect(screen.getAllByTestId("letter-cell")).toHaveLength(3);
  });

  it("shows a hint button with the expected tooltip only when active", () => {
    const { rerender } = render(<ChainRow cells={CELLS} showHintButton={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<ChainRow cells={CELLS} showHintButton={true} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      "Reveal the next letter of this word · costs 5s added to your time"
    );
  });

  it("calls onHintClick when the hint button is clicked", async () => {
    const onHintClick = vi.fn();
    render(<ChainRow cells={CELLS} showHintButton={true} onHintClick={onHintClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onHintClick).toHaveBeenCalledTimes(1);
  });
});
```

Add `@testing-library/user-event` to `client/package.json` devDependencies (`"@testing-library/user-event": "^14.5.0"`) and run `npm install` if it wasn't already added in Task 1.

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/components/ChainRow.js'`

- [ ] **Step 7: Implement ChainRow.tsx**

```tsx
// client/src/components/ChainRow.tsx

import { LetterCell, type LetterCellState } from "./LetterCell.js";

export interface ChainCellData {
  letter?: string;
  state: LetterCellState;
}

export interface ChainRowProps {
  cells: ChainCellData[];
  showHintButton: boolean;
  onHintClick?: () => void;
}

export function ChainRow({ cells, showHintButton, onHintClick }: ChainRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      {cells.map((cell, i) => (
        <LetterCell key={i} letter={cell.letter} state={cell.state} />
      ))}
      {showHintButton && (
        <button
          type="button"
          title="Reveal the next letter of this word · costs 5s added to your time"
          onClick={onHintClick}
          className="ml-2 w-8 h-8 rounded-full bg-white/25 border-2 border-white text-base flex items-center justify-center cursor-help"
        >
          💡
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/package.json client/src/components/LetterCell.tsx client/src/components/ChainRow.tsx client/tests/LetterCell.test.tsx client/tests/ChainRow.test.tsx
git commit -m "Add LetterCell and ChainRow components with tests"
```

---

## Task 23: ChainBoard component

The signature UI piece: composes `ChainRow`s from the server's public row/board-view data (the client never receives solution words), manages local per-row typing state, and wires submit/hint callbacks.

**Files:**
- Modify: `shared/src/chainSolver.ts` (extract `getActiveRowsFromBounds`, since the client only has `topSolved`/`bottomSolved` — never the secret `words` array `getActiveRows` currently requires)
- Modify: `shared/tests/chainSolver.test.ts` (add a test for it)
- Create: `client/src/components/ChainBoard.tsx`
- Test: `client/tests/ChainBoard.test.tsx`

**Interfaces:**
- Consumes: `PublicChainRow`/`PublicBoardView` (Task 14/15), `ChainRow`/`ChainCellData` (Task 22)
- Produces: `getActiveRowsFromBounds(topSolved, bottomSolved): number[]`; `ChainBoard` (props: `rows: PublicChainRow[]`, `boardView: PublicBoardView`, `onSubmitGuess: (rowIndex, guess) => void`, `onHint: (rowIndex) => void`). Consumed by Task 28 (`PlayerRoundPage`) and Task 29 (`HostRoundPage`, read-only mini boards).

- [ ] **Step 1: Add the failing shared test**

Append to `shared/tests/chainSolver.test.ts`:

```ts
import { getActiveRowsFromBounds } from "../src/chainSolver.js";

describe("getActiveRowsFromBounds", () => {
  it("matches getActiveRows given the same bounds, without needing the solution words", () => {
    expect(getActiveRowsFromBounds(0, 5)).toEqual([1, 4]);
    expect(getActiveRowsFromBounds(2, 3)).toEqual([3]);
    expect(getActiveRowsFromBounds(2, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=shared`
Expected: FAIL — `getActiveRowsFromBounds is not exported`.

- [ ] **Step 3: Extract getActiveRowsFromBounds in chainSolver.ts**

Replace the existing `getActiveRows` function with:

```ts
export function getActiveRowsFromBounds(topSolved: number, bottomSolved: number): number[] {
  const top = topSolved + 1;
  const bottom = bottomSolved - 1;
  if (top > bottom) return [];
  if (top === bottom) return [top];
  return [top, bottom];
}

export function getActiveRows(state: ChainState): number[] {
  return getActiveRowsFromBounds(state.topSolved, state.bottomSolved);
}
```

- [ ] **Step 4: Run the shared tests to verify everything still passes**

Run: `npm run test --workspace=shared`
Expected: PASS — the pre-existing `getActiveRows` tests still pass unchanged, plus the new `getActiveRowsFromBounds` test.

- [ ] **Step 5: Write the failing ChainBoard test**

Create `client/tests/ChainBoard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicBoardView, PublicChainRow } from "@wordchain/shared";
import { ChainBoard } from "../src/components/ChainBoard.js";

const ROWS: PublicChainRow[] = [
  { index: 0, length: 3, isClue: true, text: "HOT" },
  { index: 1, length: 3, isClue: false },
  { index: 2, length: 3, isClue: false },
  { index: 3, length: 5, isClue: false },
  { index: 4, length: 4, isClue: false },
  { index: 5, length: 4, isClue: true, text: "KICK" },
];

const INITIAL_VIEW: PublicBoardView = {
  topSolved: 0,
  bottomSolved: 5,
  revealedText: {},
  penaltySeconds: 0,
};

describe("ChainBoard", () => {
  it("renders a hint button only for the two currently active rows", () => {
    render(
      <ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={vi.fn()} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders clue text as locked cells", () => {
    render(
      <ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={vi.fn()} />
    );
    const hotCells = screen.getAllByTestId("letter-cell").slice(0, 3);
    expect(hotCells.map((c) => c.textContent).join("")).toBe("HOT");
    expect(hotCells.every((c) => c.getAttribute("data-state") === "locked")).toBe(true);
  });

  it("submits the typed guess for the active row on Enter", async () => {
    const onSubmitGuess = vi.fn();
    render(
      <ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={onSubmitGuess} onHint={vi.fn()} />
    );
    const input = screen.getByLabelText("Guess for row 1");
    await userEvent.type(input, "DOG{enter}");
    expect(onSubmitGuess).toHaveBeenCalledWith(1, "DOG");
  });

  it("calls onHint with the row index when a hint button is clicked", async () => {
    const onHint = vi.fn();
    render(<ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={onHint} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]); // row 1's hint button (rendered before row 4's)
    expect(onHint).toHaveBeenCalledWith(1);
  });

  it("shows a solved row's revealed text in green and stops offering it as active", () => {
    const view: PublicBoardView = {
      topSolved: 1,
      bottomSolved: 5,
      revealedText: { 0: "HOT", 1: "DOG" },
      penaltySeconds: 0,
    };
    render(<ChainBoard rows={ROWS} boardView={view} onSubmitGuess={vi.fn()} onHint={vi.fn()} />);
    expect(screen.queryByLabelText("Guess for row 1")).not.toBeInTheDocument();
    const dogCells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(dogCells.map((c) => c.textContent).join("")).toBe("DOG");
    expect(dogCells.every((c) => c.getAttribute("data-state") === "solved")).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/components/ChainBoard.js'`

- [ ] **Step 7: Implement ChainBoard.tsx**

```tsx
// client/src/components/ChainBoard.tsx

import { useState } from "react";
import { getActiveRowsFromBounds, type PublicBoardView, type PublicChainRow } from "@wordchain/shared";
import { ChainRow, type ChainCellData } from "./ChainRow.js";

export interface ChainBoardProps {
  rows: PublicChainRow[];
  boardView: PublicBoardView;
  onSubmitGuess: (rowIndex: number, guess: string) => void;
  onHint: (rowIndex: number) => void;
}

export function ChainBoard({ rows, boardView, onSubmitGuess, onHint }: ChainBoardProps) {
  const [typedByRow, setTypedByRow] = useState<Record<number, string>>({});
  const activeRows = getActiveRowsFromBounds(boardView.topSolved, boardView.bottomSolved);

  function handleChange(rowIndex: number, value: string, length: number) {
    setTypedByRow((prev) => ({ ...prev, [rowIndex]: value.toUpperCase().slice(0, length) }));
  }

  function handleSubmit(rowIndex: number) {
    const guess = typedByRow[rowIndex] ?? "";
    if (guess.length === 0) return;
    onSubmitGuess(rowIndex, guess);
    setTypedByRow((prev) => ({ ...prev, [rowIndex]: "" }));
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      {rows.map((row) => {
        const isActive = activeRows.includes(row.index);
        const solvedFully = row.index <= boardView.topSolved || row.index >= boardView.bottomSolved;
        const revealed = boardView.revealedText[row.index];
        const typed = typedByRow[row.index] ?? "";

        const cells: ChainCellData[] = Array.from({ length: row.length }, (_, i) => {
          if (row.isClue) return { letter: row.text?.[i], state: "locked" as const };
          if (revealed && i < revealed.length) {
            return { letter: revealed[i], state: (solvedFully ? "solved" : "hinted") as const };
          }
          if (isActive && i < typed.length) return { letter: typed[i], state: "typing" as const };
          return { letter: undefined, state: "empty" as const };
        });

        return (
          <div key={row.index} className="flex items-center gap-2">
            <ChainRow cells={cells} showHintButton={isActive} onHintClick={() => onHint(row.index)} />
            {isActive && (
              <input
                aria-label={`Guess for row ${row.index}`}
                className="sr-only"
                value={typed}
                maxLength={row.length}
                onChange={(e) => handleChange(row.index, e.target.value, row.length)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit(row.index);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add shared/src/chainSolver.ts shared/tests/chainSolver.test.ts client/src/components/ChainBoard.tsx client/tests/ChainBoard.test.tsx
git commit -m "Add ChainBoard component composing rows from server-safe public data"
```

---

## Task 24: App shell (screen state machine) and JoinPage

Rather than URL-based routing, the app is a single-page state machine: one top-level `screen` value advances in response to user actions and socket events (this matches how Kahoot/Jackbox-style clients work — the URL doesn't change mid-game). `App.tsx` owns the current screen; each page is a plain component that receives the data and callbacks it needs as props.

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/JoinPage.tsx`
- Test: `client/tests/JoinPage.test.tsx`

**Interfaces:**
- Consumes: `getSocket` (Task 20)
- Produces: `Screen` union type in `App.tsx` (`{ name: "landing" } | { name: "join" } | { name: "hostSetup" } | { name: "hostLobby" } | { name: "playerLobby" } | { name: "round"; role } | { name: "results"; role }` — there's no separate "final" screen; Task 30's `ResultsPage` renders podium/confetti styling in place once the playlist is exhausted); `JoinPage` (props: `onJoined: (nickname: string) => void`). Consumed by Tasks 25-30 (every other page plugs into this state machine).

- [ ] **Step 1: Write the failing JoinPage test**

Create `client/tests/JoinPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinPage } from "../src/pages/JoinPage.js";

vi.mock("../src/socket.js", () => ({
  getSocket: () => ({
    emit: (
      _event: string,
      _payload: unknown,
      callback: (response: { success: boolean; mode?: string; teams?: unknown[] }) => void
    ) => callback({ success: true, mode: "individual", teams: [] }),
  }),
}));

describe("JoinPage", () => {
  it("disables the join button until both fields are filled", async () => {
    render(<JoinPage onJoined={vi.fn()} />);
    const joinButton = screen.getByRole("button", { name: /join/i });
    expect(joinButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    expect(joinButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    expect(joinButton).toBeEnabled();
  });

  it("calls onJoined with the nickname and room mode after a successful join", async () => {
    const onJoined = vi.fn();
    render(<JoinPage onJoined={onJoined} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(onJoined).toHaveBeenCalledWith({ nickname: "Alex", mode: "individual", teams: [] });
  });

  it("shows the server's error message when the join fails", async () => {
    vi.doMock("../src/socket.js", () => ({
      getSocket: () => ({
        emit: (_event: string, _payload: unknown, callback: (response: { success: boolean; error?: string }) => void) =>
          callback({ success: false, error: "Room not found" }),
      }),
    }));
    const { JoinPage: JoinPageWithFailingSocket } = await import("../src/pages/JoinPage.js");
    render(<JoinPageWithFailingSocket onJoined={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "NOPE-00");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(await screen.findByText("Room not found")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/JoinPage.js'`

- [ ] **Step 3: Implement JoinPage.tsx**

```tsx
// client/src/pages/JoinPage.tsx

import { useState } from "react";
import { getSocket } from "../socket.js";

export interface JoinedData {
  nickname: string;
  mode: "individual" | "team";
  teams: { id: string; name: string }[];
}

export interface JoinPageProps {
  onJoined: (data: JoinedData) => void;
}

export function JoinPage({ onJoined }: JoinPageProps) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canJoin = code.trim().length > 0 && nickname.trim().length > 0;

  function handleJoin() {
    setError(null);
    getSocket().emit(
      "player:joinRoom",
      { code: code.trim().toUpperCase(), nickname: nickname.trim() },
      (response: JoinedData & { success: boolean; error?: string }) => {
        if (response.success) {
          onJoined({ nickname: nickname.trim(), mode: response.mode, teams: response.teams });
        } else {
          setError(response.error ?? "Could not join the room");
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4 shadow-xl">
        <h1 className="font-display text-2xl font-extrabold text-chain-locked text-center">Join a game</h1>

        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Room code
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2 uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BLUE-42"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Nickname
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
          />
        </label>

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

        <button
          type="button"
          disabled={!canJoin}
          onClick={handleJoin}
          className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full py-3 font-display font-extrabold text-chain-locked"
        >
          Join
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire JoinPage into App.tsx's screen state machine**

Replace `client/src/App.tsx` entirely:

```tsx
// client/src/App.tsx

import { useState } from "react";
import { JoinPage } from "./pages/JoinPage.js";

export type Role = "host" | "player";

export type Screen =
  | { name: "landing" }
  | { name: "join" }
  | { name: "hostSetup" }
  | { name: "hostLobby" }
  | { name: "playerLobby" }
  | { name: "round"; role: Role }
  | { name: "results"; role: Role };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "landing" });

  if (screen.name === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6">
        <h1 className="font-display text-4xl text-white font-extrabold">Word Chain</h1>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setScreen({ name: "hostSetup" })}
            className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-6 py-3 font-display font-extrabold text-chain-locked"
          >
            Host a game
          </button>
          <button
            type="button"
            onClick={() => setScreen({ name: "join" })}
            className="bg-white shadow-[0_4px_0_#cccccc] rounded-full px-6 py-3 font-display font-extrabold text-chain-locked"
          >
            Join a game
          </button>
        </div>
      </div>
    );
  }

  if (screen.name === "join") {
    return (
      <JoinPage
        onJoined={() => {
          setScreen({ name: "playerLobby" });
        }}
      />
    );
  }

  // Tasks 25-30 replace this fallback with the remaining screens.
  return null;
}
```

(Task 27 revisits this branch to actually store the joined nickname/mode/teams data — this task only wires the transition.)

- [ ] **Step 6: Manual verification**

Run: `npm run dev --workspace=client`
Expected: landing screen shows "Host a game" / "Join a game" buttons; clicking "Join a game" shows the join form; the Join button is disabled until both fields have text.

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/pages/JoinPage.tsx client/tests/JoinPage.test.tsx
git commit -m "Add app screen state machine and JoinPage"
```

---

## Task 25: HostSetupPage

**Files:**
- Create: `client/src/pages/HostSetupPage.tsx`
- Test: `client/tests/HostSetupPage.test.tsx`
- Modify: `client/src/App.tsx` (render it for the `hostSetup` screen, add room/playlist state)

**Interfaces:**
- Consumes: `PUZZLE_LIBRARY` (Task 9, shared), `getSocket` (Task 20)
- Produces: `HostSetupPage` (props: `onRoomCreated: (data: { code: string; mode: GameMode; playlist: Puzzle[] }) => void`). Consumed by Task 26 (`HostLobbyPage`) via the `App.tsx` state it populates.

- [ ] **Step 1: Write the failing test**

Create `client/tests/HostSetupPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PUZZLE_LIBRARY } from "@wordchain/shared";
import { HostSetupPage } from "../src/pages/HostSetupPage.js";

const emitMock = vi.fn(
  (_event: string, _payload: unknown, callback: (response: { code: string }) => void) =>
    callback({ code: "BLUE-42" })
);
vi.mock("../src/socket.js", () => ({
  getSocket: () => ({ emit: emitMock }),
}));

describe("HostSetupPage", () => {
  it("disables Create Room until at least one puzzle is selected", () => {
    render(<HostSetupPage onRoomCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /create room/i })).toBeDisabled();
  });

  it("creates an individual-mode room with the selected puzzles as the playlist", async () => {
    const onRoomCreated = vi.fn();
    render(<HostSetupPage onRoomCreated={onRoomCreated} />);

    await userEvent.click(screen.getByLabelText(PUZZLE_LIBRARY[0].category, { exact: false }));
    await userEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(emitMock).toHaveBeenCalledWith(
      "host:createRoom",
      { mode: "individual", teams: undefined },
      expect.any(Function)
    );
    expect(onRoomCreated).toHaveBeenCalledWith({
      code: "BLUE-42",
      mode: "individual",
      playlist: [PUZZLE_LIBRARY[0]],
    });
  });

  it("shows a team-name input only in team mode and includes teams when creating the room", async () => {
    render(<HostSetupPage onRoomCreated={vi.fn()} />);
    expect(screen.queryByLabelText(/team names/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/team mode/i));
    expect(screen.getByLabelText(/team names/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/team names/i), "Red Team, Blue Team");
    await userEvent.click(screen.getByLabelText(PUZZLE_LIBRARY[0].category, { exact: false }));
    await userEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(emitMock).toHaveBeenCalledWith(
      "host:createRoom",
      {
        mode: "team",
        teams: [
          { id: "team-1", name: "Red Team" },
          { id: "team-2", name: "Blue Team" },
        ],
      },
      expect.any(Function)
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/HostSetupPage.js'`

- [ ] **Step 3: Implement HostSetupPage.tsx**

```tsx
// client/src/pages/HostSetupPage.tsx

import { useState } from "react";
import { PUZZLE_LIBRARY, type GameMode, type Puzzle, type TeamInfo } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface HostSetupPageProps {
  onRoomCreated: (data: { code: string; mode: GameMode; playlist: Puzzle[] }) => void;
}

export function HostSetupPage({ onRoomCreated }: HostSetupPageProps) {
  const [mode, setMode] = useState<GameMode>("individual");
  const [teamNamesInput, setTeamNamesInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function buildTeams(): TeamInfo[] | undefined {
    if (mode !== "team") return undefined;
    return teamNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name, index) => ({ id: `team-${index + 1}`, name }));
  }

  function handleCreateRoom() {
    const teams = buildTeams();
    getSocket().emit("host:createRoom", { mode, teams }, (response: { code: string }) => {
      const playlist = PUZZLE_LIBRARY.filter((p) => selectedIds.has(p.id));
      onRoomCreated({ code: response.code, mode, playlist });
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-3xl text-white font-extrabold">Set up your game</h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4">
        <fieldset className="flex gap-4">
          <label className="flex items-center gap-2 font-semibold text-chain-locked">
            <input
              type="radio"
              name="mode"
              checked={mode === "individual"}
              onChange={() => setMode("individual")}
            />
            Individual mode
          </label>
          <label className="flex items-center gap-2 font-semibold text-chain-locked">
            <input type="radio" name="mode" checked={mode === "team"} onChange={() => setMode("team")} />
            Team mode
          </label>
        </fieldset>

        {mode === "team" && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
            Team names (comma separated)
            <input
              className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
              value={teamNamesInput}
              onChange={(e) => setTeamNamesInput(e.target.value)}
              placeholder="Red Team, Blue Team"
            />
          </label>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-chain-locked">Puzzles for this game</span>
          {PUZZLE_LIBRARY.map((puzzle) => (
            <label key={puzzle.id} className="flex items-center gap-2 text-chain-locked">
              <input
                type="checkbox"
                checked={selectedIds.has(puzzle.id)}
                onChange={() => toggleSelected(puzzle.id)}
              />
              {puzzle.category} — {puzzle.words[0]}...{puzzle.words[puzzle.words.length - 1]} ({puzzle.difficulty})
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={handleCreateRoom}
          className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full py-3 font-display font-extrabold text-chain-locked"
        >
          Create Room
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import, add room/playlist state, and render `HostSetupPage` for the `hostSetup` screen:

```ts
// add near the other imports
import { HostSetupPage } from "./pages/HostSetupPage.js";
import type { GameMode, Puzzle } from "@wordchain/shared";
```

Add this state alongside the existing `screen` state:

```ts
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("individual");
  const [playlist, setPlaylist] = useState<Puzzle[]>([]);
```

Replace the final `return null;` fallback with:

```tsx
  if (screen.name === "hostSetup") {
    return (
      <HostSetupPage
        onRoomCreated={(data) => {
          setRoomCode(data.code);
          setMode(data.mode);
          setPlaylist(data.playlist);
          setScreen({ name: "hostLobby" });
        }}
      />
    );
  }

  return null;
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev --workspace=client`
Click "Host a game" from the landing screen.
Expected: mode toggle, puzzle checklist, and a disabled "Create Room" button that enables once a puzzle is checked; selecting "Team mode" reveals the team names field.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/HostSetupPage.tsx client/src/App.tsx client/tests/HostSetupPage.test.tsx
git commit -m "Add HostSetupPage with mode, teams, and playlist selection"
```

---

## Task 26: HostLobbyPage

**Files:**
- Create: `client/src/pages/HostLobbyPage.tsx`
- Test: `client/tests/HostLobbyPage.test.tsx`
- Modify: `client/src/App.tsx` (render it for the `hostLobby` screen, track `currentPuzzleIndex`)
- Modify: `client/package.json` (add `qrcode.react` if not already present from Task 1)

**Interfaces:**
- Consumes: `getSocket` (Task 20), `PlayerInfo` type (Task 2)
- Produces: `HostLobbyPage` (props: `roomCode: string`, `playlist: Puzzle[]`, `onStarted: () => void`). Consumed by Task 29 (`HostRoundPage`, via `App.tsx`'s `currentPuzzleIndex`).

- [ ] **Step 1: Write the failing test**

Create `client/tests/HostLobbyPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Puzzle } from "@wordchain/shared";
import { HostLobbyPage } from "../src/pages/HostLobbyPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true }));
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const PLAYLIST: Puzzle[] = [
  { id: "p1", category: "Classics", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 },
];

describe("HostLobbyPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("shows the room code", () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    expect(screen.getByText("BLUE-42")).toBeInTheDocument();
  });

  it("adds a player to the list when room:playerJoined fires", () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    });
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("kicks a player when their kick button is clicked", async () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    });
    await userEvent.click(screen.getByRole("button", { name: /kick alex/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("host:kickPlayer", { socketId: "p1" }, expect.any(Function));
  });

  it("starts the first puzzle in the playlist, flags it as the last round when the playlist has one entry, and calls onStarted", async () => {
    const onStarted = vi.fn();
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={onStarted} />);
    await userEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "host:startRound",
      { puzzle: PLAYLIST[0], isLastRound: true },
      expect.any(Function)
    );
    expect(onStarted).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/HostLobbyPage.js'`

- [ ] **Step 3: Implement HostLobbyPage.tsx**

```tsx
// client/src/pages/HostLobbyPage.tsx

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Puzzle, PlayerInfo } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface HostLobbyPageProps {
  roomCode: string;
  playlist: Puzzle[];
  onStarted: () => void;
}

export function HostLobbyPage({ roomCode, playlist, onStarted }: HostLobbyPageProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  useEffect(() => {
    const socket = getSocket();

    function upsertPlayer(player: PlayerInfo) {
      setPlayers((prev) => {
        const withoutExisting = prev.filter((p) => p.socketId !== player.socketId);
        return [...withoutExisting, player];
      });
    }
    function removePlayer(payload: { socketId: string }) {
      setPlayers((prev) => prev.filter((p) => p.socketId !== payload.socketId));
    }

    socket.on("room:playerJoined", upsertPlayer);
    socket.on("room:playerUpdated", upsertPlayer);
    socket.on("room:playerLeft", removePlayer);

    return () => {
      socket.off("room:playerJoined");
      socket.off("room:playerUpdated");
      socket.off("room:playerLeft");
    };
  }, []);

  function handleKick(socketId: string) {
    getSocket().emit("host:kickPlayer", { socketId }, () => {});
  }

  function handleStart() {
    getSocket().emit(
      "host:startRound",
      { puzzle: playlist[0], isLastRound: playlist.length === 1 },
      () => {
        onStarted();
      }
    );
  }

  const joinUrl = `${window.location.origin}/join?code=${roomCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-2xl text-white font-extrabold">Room code</h1>
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
        <p className="font-display text-4xl font-black text-chain-locked tracking-widest">{roomCode}</p>
        <QRCodeSVG value={joinUrl} size={140} aria-label="Room QR code" />
      </div>

      <div className="bg-white/95 rounded-2xl p-6 w-full max-w-md">
        <h2 className="font-display text-lg font-bold text-chain-locked mb-3">
          Players ({players.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.socketId} className="flex items-center justify-between">
              <span className="text-chain-locked">{player.nickname}</span>
              <button
                type="button"
                onClick={() => handleKick(player.socketId)}
                aria-label={`Kick ${player.nickname}`}
                className="text-red-600 text-sm font-semibold"
              >
                Kick
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={handleStart}
        className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-8 py-3 font-display font-extrabold text-chain-locked"
      >
        Start Game
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import and a `currentPuzzleIndex` state, and render `HostLobbyPage` for the `hostLobby` screen:

```ts
// add near the other imports
import { HostLobbyPage } from "./pages/HostLobbyPage.js";
```

Add alongside the existing state:

```ts
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
```

Add this branch before the final `return null;`:

```tsx
  if (screen.name === "hostLobby" && roomCode) {
    return (
      <HostLobbyPage
        roomCode={roomCode}
        playlist={playlist}
        onStarted={() => {
          setCurrentPuzzleIndex(0);
          setScreen({ name: "round", role: "host" });
        }}
      />
    );
  }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev --workspace=client` and `npm run dev --workspace=server` (two terminals).
Host a game, select a puzzle, create the room.
Expected: room code and a scannable QR code render; opening the join URL from another tab/device and joining adds that player's name to the lobby list within a second; clicking "Kick" next to a name removes them from both browsers.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/HostLobbyPage.tsx client/src/App.tsx client/package.json client/tests/HostLobbyPage.test.tsx
git commit -m "Add HostLobbyPage with live player list, QR code, and kick"
```

---

## Task 27: PlayerLobbyPage

**Files:**
- Create: `client/src/pages/PlayerLobbyPage.tsx`
- Test: `client/tests/PlayerLobbyPage.test.tsx`
- Modify: `client/src/App.tsx` (store joined nickname/mode/teams, render `PlayerLobbyPage` for the `playerLobby` screen)

**Interfaces:**
- Consumes: `getSocket` (Task 20), `JoinedData` (Task 24)
- Produces: `PlayerLobbyPage` (props: `mode: GameMode`, `teams: TeamInfo[]`, `onTeamSelected: (teamId: string) => void`, `onRoundStarted: (payload: RoundStartedPayload) => void`). Consumed by Task 28 (`PlayerRoundPage` needs to know "my" entrant id — the team id in team mode — which `onTeamSelected` surfaces up to `App.tsx`).

- [ ] **Step 1: Write the failing test**

Create `client/tests/PlayerLobbyPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerLobbyPage } from "../src/pages/PlayerLobbyPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true }));
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

describe("PlayerLobbyPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("shows a waiting message directly in individual mode", () => {
    render(<PlayerLobbyPage mode="individual" teams={[]} onTeamSelected={vi.fn()} onRoundStarted={vi.fn()} />);
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("shows team choices in team mode, selects one on click, and reports it up", async () => {
    const onTeamSelected = vi.fn();
    render(
      <PlayerLobbyPage
        mode="team"
        teams={[{ id: "t1", name: "Red Team" }, { id: "t2", name: "Blue Team" }]}
        onTeamSelected={onTeamSelected}
        onRoundStarted={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Red Team" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("player:selectTeam", { teamId: "t1" }, expect.any(Function));
    expect(onTeamSelected).toHaveBeenCalledWith("t1");
    expect(await screen.findByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("calls onRoundStarted with the round payload when round:started fires", () => {
    const onRoundStarted = vi.fn();
    render(<PlayerLobbyPage mode="individual" teams={[]} onTeamSelected={vi.fn()} onRoundStarted={onRoundStarted} />);
    const payload = { puzzleId: "p1", rows: [], timeCapSeconds: 60, category: "Test", startedAt: 0, isLastRound: false };
    act(() => {
      fakeSocket.trigger("round:started", payload);
    });
    expect(onRoundStarted).toHaveBeenCalledWith(payload);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/PlayerLobbyPage.js'`

- [ ] **Step 3: Implement PlayerLobbyPage.tsx**

```tsx
// client/src/pages/PlayerLobbyPage.tsx

import { useEffect, useState } from "react";
import type { GameMode, TeamInfo, RoundStartedPayload } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface PlayerLobbyPageProps {
  mode: GameMode;
  teams: TeamInfo[];
  onTeamSelected: (teamId: string) => void;
  onRoundStarted: (payload: RoundStartedPayload) => void;
}

export function PlayerLobbyPage({ mode, teams, onTeamSelected, onRoundStarted }: PlayerLobbyPageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("round:started", onRoundStarted);
    return () => socket.off("round:started");
  }, [onRoundStarted]);

  function selectTeam(teamId: string) {
    getSocket().emit("player:selectTeam", { teamId }, () => {
      setSelectedTeamId(teamId);
      onTeamSelected(teamId);
    });
  }

  const showTeamChoice = mode === "team" && selectedTeamId === null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4 items-center text-center">
        {showTeamChoice ? (
          <>
            <h1 className="font-display text-xl font-extrabold text-chain-locked">Pick a team</h1>
            <div className="flex flex-col gap-2 w-full">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => selectTeam(team.id)}
                  className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full py-2 font-display font-extrabold text-chain-locked"
                >
                  {team.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-extrabold text-chain-locked">You're in! 🎉</h1>
            <p className="text-chain-locked/70">Waiting for the host to start the game...</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import and joined-data state, update the `join` branch, and add the `playerLobby` branch:

```ts
// add near the other imports
import { PlayerLobbyPage } from "./pages/PlayerLobbyPage.js";
import type { TeamInfo } from "@wordchain/shared";
```

Add alongside the existing state:

```ts
  const [nickname, setNickname] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
```

Replace the `join` branch from Task 24 with:

```tsx
  if (screen.name === "join") {
    return (
      <JoinPage
        onJoined={(data) => {
          setNickname(data.nickname);
          setMode(data.mode);
          setTeams(data.teams);
          setScreen({ name: "playerLobby" });
        }}
      />
    );
  }
```

Add this state alongside the others: `roundData` holds the most recent `round:started` payload so `PlayerRoundPage` (Task 28) can render immediately without racing a duplicate event subscription; `myTeamId` records which team this player picked (needed in Task 28 to know which shared board is "mine" in team mode):

```ts
  const [roundData, setRoundData] = useState<RoundStartedPayload | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
```

(add `RoundStartedPayload` to the `@wordchain/shared` import line already present in this file)

Add this branch before the final `return null;`:

```tsx
  if (screen.name === "playerLobby") {
    return (
      <PlayerLobbyPage
        mode={mode}
        teams={teams}
        onTeamSelected={(teamId) => setMyTeamId(teamId)}
        onRoundStarted={(payload) => {
          setRoundData(payload);
          setScreen({ name: "round", role: "player" });
        }}
      />
    );
  }
```

- [ ] **Step 6: Manual verification**

With the server running and a room already created (Task 26's manual check), join from a second browser tab as a player in team mode.
Expected: team choice buttons appear; clicking one switches to "You're in!"; when the host starts the round, this tab transitions away from the lobby automatically.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/PlayerLobbyPage.tsx client/src/App.tsx client/tests/PlayerLobbyPage.test.tsx
git commit -m "Add PlayerLobbyPage with team selection and round-start transition"
```

---

## Task 28: PlayerRoundPage

Wires `ChainBoard` to the live socket events, filtering `board:updated` broadcasts down to "my" entrant (own socket id in individual mode, own team id in team mode — since the server broadcasts every entrant's updates to the whole room per Task 15).

**Files:**
- Create: `client/src/pages/PlayerRoundPage.tsx`
- Test: `client/tests/PlayerRoundPage.test.tsx`
- Modify: `client/src/App.tsx` (render it for the `round` screen when `role === "player"`)

**Interfaces:**
- Consumes: `ChainBoard` (Task 23), `playTone` (Task 21), `getSocket` (Task 20), `RoundStartedPayload`/`RoundResult` (Task 2/14)
- Produces: `PlayerRoundPage` (props: `roundData: RoundStartedPayload`, `mode: GameMode`, `myTeamId: string | null`, `onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void`). Consumed by Task 30 (`ResultsPage`, via the `App.tsx` transition it triggers).

- [ ] **Step 1: Write the failing test**

Create `client/tests/PlayerRoundPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundStartedPayload } from "@wordchain/shared";
import { PlayerRoundPage } from "../src/pages/PlayerRoundPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true, correct: true }));
  return {
    id: "my-socket-id",
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));
vi.mock("../src/sound.js", () => ({ playTone: vi.fn() }));

const ROUND_DATA: RoundStartedPayload = {
  puzzleId: "p1",
  category: "Classics",
  timeCapSeconds: 60,
  startedAt: 0,
  isLastRound: false,
  rows: [
    { index: 0, length: 3, isClue: true, text: "HOT" },
    { index: 1, length: 3, isClue: false },
    { index: 2, length: 4, isClue: true, text: "KICK" },
  ],
};

describe("PlayerRoundPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("shows the puzzle category", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    expect(screen.getByText("Classics")).toBeInTheDocument();
  });

  it("applies a board:updated event addressed to my own socket id", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "my-socket-id",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.map((c) => c.textContent).join("")).toBe("DOG");
  });

  it("ignores a board:updated event addressed to someone else", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "someone-elses-socket",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.every((c) => c.textContent === "")).toBe(true);
  });

  it("uses the team id (not the socket id) to filter updates in team mode", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="team" myTeamId="t1" onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "t1",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.map((c) => c.textContent).join("")).toBe("DOG");
  });

  it("shows a solved message when player:chainComplete fires for me", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("player:chainComplete", { entrantId: "my-socket-id" });
    });
    expect(screen.getByText(/solved/i)).toBeInTheDocument();
  });

  it("calls onResults when round:results fires", () => {
    const onResults = vi.fn();
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={onResults} />);
    const payload = { results: [], totals: {} };
    act(() => {
      fakeSocket.trigger("round:results", payload);
    });
    expect(onResults).toHaveBeenCalledWith(payload);
  });

  it("submits a typed guess for the active row", async () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    const input = screen.getByLabelText("Guess for row 1");
    await userEvent.type(input, "DOG{enter}");
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "player:submitGuess",
      { rowIndex: 1, guess: "DOG" },
      expect.any(Function)
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/PlayerRoundPage.js'`

- [ ] **Step 3: Implement PlayerRoundPage.tsx**

```tsx
// client/src/pages/PlayerRoundPage.tsx

import { useEffect, useState } from "react";
import type { GameMode, PublicBoardView, PublicChainRow, RoundResult, RoundStartedPayload } from "@wordchain/shared";
import { ChainBoard } from "../components/ChainBoard.js";
import { getSocket } from "../socket.js";
import { playTone } from "../sound.js";

export interface PlayerRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  myTeamId: string | null;
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}

function initialBoardView(rows: PublicChainRow[]): PublicBoardView {
  const revealedText: Record<number, string> = {};
  rows.forEach((row) => {
    if (row.isClue) revealedText[row.index] = row.text!;
  });
  return { topSolved: 0, bottomSolved: rows.length - 1, revealedText, penaltySeconds: 0 };
}

export function PlayerRoundPage({ roundData, mode, myTeamId, onResults }: PlayerRoundPageProps) {
  const [boardView, setBoardView] = useState<PublicBoardView>(() => initialBoardView(roundData.rows));
  const [finished, setFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const myEntrantId = mode === "team" ? myTeamId : getSocket().id;

  useEffect(() => {
    const socket = getSocket();

    function handleBoardUpdated(payload: { entrantId: string; view: PublicBoardView }) {
      if (payload.entrantId !== myEntrantId) return;
      setBoardView(payload.view);
    }
    function handleChainComplete(payload: { entrantId: string }) {
      if (payload.entrantId !== myEntrantId) return;
      setFinished(true);
      playTone("complete");
    }
    function handleResults(payload: { results: RoundResult[]; totals: Record<string, number> }) {
      onResults(payload);
    }

    socket.on("board:updated", handleBoardUpdated);
    socket.on("player:chainComplete", handleChainComplete);
    socket.on("round:results", handleResults);
    return () => {
      socket.off("board:updated");
      socket.off("player:chainComplete");
      socket.off("round:results");
    };
  }, [myEntrantId, onResults]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - roundData.startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [roundData.startedAt]);

  function handleSubmitGuess(rowIndex: number, guess: string) {
    getSocket().emit("player:submitGuess", { rowIndex, guess }, (response: { correct?: boolean }) => {
      playTone(response.correct ? "correct" : "wrong");
    });
  }

  function handleHint(rowIndex: number) {
    getSocket().emit("player:useHint", { rowIndex }, () => {});
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-6 flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-md text-white font-display font-bold">
        <span>{roundData.category}</span>
        <span>{elapsedSeconds}s</span>
      </div>

      {finished ? (
        <p className="text-white font-display text-2xl font-extrabold mt-8">🔥 Solved! Waiting for others...</p>
      ) : (
        <ChainBoard
          rows={roundData.rows}
          boardView={boardView}
          onSubmitGuess={handleSubmitGuess}
          onHint={handleHint}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import and a `results` state, and render `PlayerRoundPage` for the `round` screen when the role is `player`:

```ts
// add near the other imports
import { PlayerRoundPage } from "./pages/PlayerRoundPage.js";
import type { RoundResult } from "@wordchain/shared";
```

Add alongside the other state:

```ts
  const [lastResults, setLastResults] = useState<{ results: RoundResult[]; totals: Record<string, number> } | null>(null);
```

Add this branch before the final `return null;` (this only handles the player path — Task 29 adds the host path for the same `round` screen name):

```tsx
  if (screen.name === "round" && screen.role === "player" && roundData) {
    return (
      <PlayerRoundPage
        roundData={roundData}
        mode={mode}
        myTeamId={myTeamId}
        onResults={(payload) => {
          setLastResults(payload);
          setScreen({ name: "results", role: "player" });
        }}
      />
    );
  }
```

- [ ] **Step 6: Manual verification**

With the server and two browser tabs (host + one player) running from the prior tasks' manual checks, start the round from the host.
Expected: the player tab shows the full chain board immediately (clue rows dark, blanks empty, hint bulbs on rows 1 and the second-to-last row), a live elapsed-seconds counter, and typing a correct word for an active row flips it green and advances which row is active.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/PlayerRoundPage.tsx client/src/App.tsx client/tests/PlayerRoundPage.test.tsx
git commit -m "Add PlayerRoundPage wiring ChainBoard to live socket events"
```

---

## Task 29: HostRoundPage

Shows one read-only mini-board per entrant, updating live, plus a manual "End Round" override. Mini-boards reuse `ChainRow` directly (not the interactive `ChainBoard`) since the host never types guesses.

**Files:**
- Create: `client/src/pages/HostRoundPage.tsx`
- Test: `client/tests/HostRoundPage.test.tsx`
- Modify: `client/src/App.tsx` (render it for the `round` screen when `role === "host"`)

**Interfaces:**
- Consumes: `ChainRow` (Task 22), `getSocket` (Task 20), `RoundStartedPayload`/`RoundResult`/`PlayerInfo`/`TeamInfo` (Task 2/14)
- Produces: `HostRoundPage` (props: `roundData: RoundStartedPayload`, `mode: GameMode`, `teams: TeamInfo[]`, `onResults: (payload) => void`). Consumed by Task 30 (`ResultsPage`, via the `App.tsx` transition it triggers).

- [ ] **Step 1: Write the failing test**

Create `client/tests/HostRoundPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundStartedPayload } from "@wordchain/shared";
import { HostRoundPage } from "../src/pages/HostRoundPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true }));
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const ROUND_DATA: RoundStartedPayload = {
  puzzleId: "p1",
  category: "Classics",
  timeCapSeconds: 60,
  startedAt: 0,
  isLastRound: false,
  rows: [
    { index: 0, length: 3, isClue: true, text: "HOT" },
    { index: 1, length: 3, isClue: false },
    { index: 2, length: 4, isClue: true, text: "KICK" },
  ],
};

describe("HostRoundPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("adds a labeled mini-board once a player has joined and their board updates", () => {
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
      fakeSocket.trigger("board:updated", {
        entrantId: "p1",
        view: { topSolved: 0, bottomSolved: 2, revealedText: { 0: "HOT", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("labels a team-mode board with the team name", () => {
    render(
      <HostRoundPage
        roundData={ROUND_DATA}
        mode="team"
        teams={[{ id: "t1", name: "Red Team" }]}
        onResults={vi.fn()}
      />
    );
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "t1",
        view: { topSolved: 0, bottomSolved: 2, revealedText: { 0: "HOT", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    expect(screen.getByText("Red Team")).toBeInTheDocument();
  });

  it("emits host:endRound when End Round is clicked", async () => {
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /end round/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("host:endRound", {}, expect.any(Function));
  });

  it("calls onResults when round:results fires", () => {
    const onResults = vi.fn();
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={onResults} />);
    const payload = { results: [], totals: {} };
    act(() => {
      fakeSocket.trigger("round:results", payload);
    });
    expect(onResults).toHaveBeenCalledWith(payload);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/HostRoundPage.js'`

- [ ] **Step 3: Implement HostRoundPage.tsx**

```tsx
// client/src/pages/HostRoundPage.tsx

import { useEffect, useState } from "react";
import type { GameMode, PublicBoardView, RoundResult, RoundStartedPayload, TeamInfo } from "@wordchain/shared";
import { ChainRow, type ChainCellData } from "../components/ChainRow.js";
import { getSocket } from "../socket.js";

export interface HostRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  teams: TeamInfo[];
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}

export function HostRoundPage({ roundData, mode, teams, onResults }: HostRoundPageProps) {
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [boards, setBoards] = useState<Record<string, PublicBoardView>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    function rememberNickname(player: { socketId: string; nickname: string }) {
      setNicknames((prev) => ({ ...prev, [player.socketId]: player.nickname }));
    }
    function handleBoardUpdated(payload: { entrantId: string; view: PublicBoardView }) {
      setBoards((prev) => ({ ...prev, [payload.entrantId]: payload.view }));
    }
    function handleResults(payload: { results: RoundResult[]; totals: Record<string, number> }) {
      onResults(payload);
    }

    socket.on("room:playerJoined", rememberNickname);
    socket.on("room:playerUpdated", rememberNickname);
    socket.on("board:updated", handleBoardUpdated);
    socket.on("round:results", handleResults);
    return () => {
      socket.off("room:playerJoined");
      socket.off("room:playerUpdated");
      socket.off("board:updated");
      socket.off("round:results");
    };
  }, [onResults]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - roundData.startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [roundData.startedAt]);

  function displayName(entrantId: string): string {
    if (mode === "team") {
      return teams.find((t) => t.id === entrantId)?.name ?? entrantId;
    }
    return nicknames[entrantId] ?? entrantId;
  }

  function handleEndRound() {
    getSocket().emit("host:endRound", {}, () => {});
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-white font-display font-bold">
        <span>{roundData.category}</span>
        <span>{elapsedSeconds}s</span>
        <button
          type="button"
          onClick={handleEndRound}
          className="bg-white/20 border-2 border-white rounded-full px-4 py-1 text-sm"
        >
          End Round
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(boards).map(([entrantId, view]) => (
          <div key={entrantId} className="bg-white/90 rounded-xl p-3">
            <p className="font-display font-bold text-chain-locked text-sm mb-2">{displayName(entrantId)}</p>
            <div className="flex flex-col gap-1">
              {roundData.rows.map((row) => {
                const revealed = view.revealedText[row.index];
                const cells: ChainCellData[] = Array.from({ length: row.length }, (_, i) => ({
                  letter: revealed?.[i],
                  state: row.isClue
                    ? "locked"
                    : revealed && i < revealed.length
                      ? "solved"
                      : "empty",
                }));
                return <ChainRow key={row.index} cells={cells} showHintButton={false} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import and render `HostRoundPage` for the `round` screen when the role is `host`:

```ts
// add near the other imports
import { HostRoundPage } from "./pages/HostRoundPage.js";
```

Add this branch alongside the player `round` branch from Task 28 (order doesn't matter, both check `screen.name === "round"` with a different `screen.role`):

```tsx
  if (screen.name === "round" && screen.role === "host") {
    return (
      <HostRoundPage
        roundData={roundData!}
        mode={mode}
        teams={teams}
        onResults={(payload) => {
          setLastResults(payload);
          setScreen({ name: "results", role: "host" });
        }}
      />
    );
  }
```

Note: the host's `roundData` needs to be populated too — modify the `hostLobby` branch from Task 26 so `onStarted` receives and stores the `host:startRound` ack (change the ack shape) — simpler: since the host already knows the puzzle it started (`playlist[currentPuzzleIndex]`), build a minimal `RoundStartedPayload` locally instead of waiting on a socket event. Update the `HostLobbyPage.handleStart` function from Task 26 to pass the started puzzle back:

In `client/src/pages/HostLobbyPage.tsx`, change the `onStarted` prop type to `onStarted: (puzzle: Puzzle) => void` and update `handleStart` (this supersedes the version from Task 26, now also carrying `isLastRound`):

```ts
  function handleStart() {
    getSocket().emit(
      "host:startRound",
      { puzzle: playlist[0], isLastRound: playlist.length === 1 },
      () => {
        onStarted(playlist[0]);
      }
    );
  }
```

Update the `HostLobbyPage.test.tsx` assertion for `onStarted` from Task 26 to `expect(onStarted).toHaveBeenCalledWith(PLAYLIST[0]);` (the `emit` assertion added in Task 26 already expects `isLastRound: true` and needs no further change).

Back in `App.tsx`, update the `hostLobby` branch to build `roundData` from the started puzzle (reusing `toPublicRows` from `@wordchain/shared`, and using `Date.now()` at click time as a close-enough local `startedAt` for the host's own timer display — the authoritative timer for scoring lives server-side):

```ts
// add to the @wordchain/shared import line
import { toPublicRows } from "@wordchain/shared";
```

```tsx
  if (screen.name === "hostLobby" && roomCode) {
    return (
      <HostLobbyPage
        roomCode={roomCode}
        playlist={playlist}
        onStarted={(puzzle) => {
          setCurrentPuzzleIndex(0);
          setRoundData({
            puzzleId: puzzle.id,
            category: puzzle.category,
            timeCapSeconds: puzzle.timeCapSeconds,
            rows: toPublicRows(puzzle.words),
            startedAt: Date.now(),
            isLastRound: playlist.length === 1,
          });
          setScreen({ name: "round", role: "host" });
        }}
      />
    );
  }
```

- [ ] **Step 6: Run the full client test suite to confirm nothing broke**

Run: `npm run test --workspace=client`
Expected: PASS — including the updated `HostLobbyPage` test.

- [ ] **Step 7: Manual verification**

With the host and one player tab from prior manual checks, start a round.
Expected: the host's screen shows one mini-board per joined player, updating within a couple hundred ms as that player types and solves rows; "End Round" immediately ends the round for everyone.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/HostRoundPage.tsx client/src/pages/HostLobbyPage.tsx client/src/App.tsx client/tests/HostRoundPage.test.tsx client/tests/HostLobbyPage.test.tsx
git commit -m "Add HostRoundPage with live mini-boards and manual end-round override"
```

---

## Task 30: ResultsPage (round results and final results)

One component handles both cases: a normal round's leaderboard reveal, and — when `isLastRound` is true — the same leaderboard with a "Final Results" heading, confetti, and a different host action button. The host derives `isLastRound` from its own playlist position; the player derives it from `roundData.isLastRound`, which the host declared when starting that round (Task 14/26).

**Files:**
- Create: `client/src/pages/ResultsPage.tsx`
- Test: `client/tests/ResultsPage.test.tsx`
- Modify: `client/src/App.tsx` (render it for the `results` screen for both roles; add the host's next-round/end-session logic)
- Modify: `client/package.json` (add `canvas-confetti` if not already present from Task 1)

**Interfaces:**
- Consumes: `getSocket` (Task 20), `RoundResult`/`RoundStartedPayload` (Task 2/14)
- Produces: `ResultsPage` (props: `results: RoundResult[]`, `totals: Record<string, number>`, `role: "host" | "player"`, `isLastRound: boolean`, `onAdvance?: () => void`, `onNextRoundStarted?: (payload: RoundStartedPayload) => void`). This is the last page task — Task 31 is an end-to-end manual pass over everything built so far.

- [ ] **Step 1: Write the failing test**

Create `client/tests/ResultsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundResult } from "@wordchain/shared";
import { ResultsPage } from "../src/pages/ResultsPage.js";

const confettiMock = vi.fn();
vi.mock("canvas-confetti", () => ({ default: confettiMock }));

type Handler = (payload: unknown) => void;
function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}
let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const RESULTS: RoundResult[] = [
  { entrantId: "p1", displayName: "Alex", finished: true, rowsSolved: 4, totalRows: 4, rawTimeSeconds: 20, points: 1000 },
  { entrantId: "p2", displayName: "Sam", finished: true, rowsSolved: 4, totalRows: 4, rawTimeSeconds: 40, points: 500 },
];
const TOTALS = { p1: 1000, p2: 500 };

describe("ResultsPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
    confettiMock.mockClear();
  });

  it("shows entrants ranked by total points, highest first", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    const names = screen.getAllByText(/Alex|Sam/).map((el) => el.textContent);
    expect(names).toEqual(["1. Alex", "2. Sam"]);
  });

  it("shows a Round Results heading and no confetti for a normal round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    expect(screen.getByText("Round Results")).toBeInTheDocument();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("shows a Final Results heading and fires confetti on the last round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={true} />);
    expect(screen.getByText(/Final Results/)).toBeInTheDocument();
    expect(confettiMock).toHaveBeenCalled();
  });

  it("shows a Next Round button for the host on a normal round, calling onAdvance", async () => {
    const onAdvance = vi.fn();
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="host" isLastRound={false} onAdvance={onAdvance} />);
    await userEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(onAdvance).toHaveBeenCalled();
  });

  it("shows an End Session button for the host on the last round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="host" isLastRound={true} onAdvance={vi.fn()} />);
    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("shows no action button for players", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onNextRoundStarted when round:started fires for a waiting player", () => {
    const onNextRoundStarted = vi.fn();
    render(
      <ResultsPage
        results={RESULTS}
        totals={TOTALS}
        role="player"
        isLastRound={false}
        onNextRoundStarted={onNextRoundStarted}
      />
    );
    const payload = { puzzleId: "p2", rows: [], timeCapSeconds: 60, category: "Test", startedAt: 0, isLastRound: false };
    act(() => {
      fakeSocket.trigger("round:started", payload);
    });
    expect(onNextRoundStarted).toHaveBeenCalledWith(payload);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/ResultsPage.js'`

- [ ] **Step 3: Implement ResultsPage.tsx**

```tsx
// client/src/pages/ResultsPage.tsx

import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { RoundResult, RoundStartedPayload } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface ResultsPageProps {
  results: RoundResult[];
  totals: Record<string, number>;
  role: "host" | "player";
  isLastRound: boolean;
  onAdvance?: () => void;
  onNextRoundStarted?: (payload: RoundStartedPayload) => void;
}

export function ResultsPage({ results, totals, role, isLastRound, onAdvance, onNextRoundStarted }: ResultsPageProps) {
  useEffect(() => {
    if (role !== "player" || !onNextRoundStarted) return;
    const socket = getSocket();
    socket.on("round:started", onNextRoundStarted);
    return () => socket.off("round:started");
  }, [role, onNextRoundStarted]);

  useEffect(() => {
    if (isLastRound) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [isLastRound]);

  const leaderboard = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([entrantId, total]) => ({
      entrantId,
      total,
      displayName: results.find((r) => r.entrantId === entrantId)?.displayName ?? entrantId,
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-6 flex flex-col items-center gap-6">
      <h1 className="font-display text-3xl text-white font-extrabold">
        {isLastRound ? "Final Results 🏆" : "Round Results"}
      </h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-2">
        {leaderboard.map((entry, index) => (
          <div key={entry.entrantId} className="flex items-center justify-between">
            <span className="font-display font-bold text-chain-locked">
              {index + 1}. {entry.displayName}
            </span>
            <span className="font-display font-extrabold text-chain-purple">{entry.total} pts</span>
          </div>
        ))}
      </div>

      {role === "host" && (
        <button
          type="button"
          onClick={onAdvance}
          className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-8 py-3 font-display font-extrabold text-chain-locked"
        >
          {isLastRound ? "End Session" : "Next Round"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Wire it into App.tsx**

Modify `client/src/App.tsx` — add the import, and render `ResultsPage` for the `results` screen for both roles:

```ts
// add near the other imports
import { ResultsPage } from "./pages/ResultsPage.js";
```

Add this branch for the host before the final `return null;`:

```tsx
  if (screen.name === "results" && screen.role === "host" && lastResults) {
    const isLastRound = currentPuzzleIndex + 1 >= playlist.length;
    return (
      <ResultsPage
        results={lastResults.results}
        totals={lastResults.totals}
        role="host"
        isLastRound={isLastRound}
        onAdvance={() => {
          if (isLastRound) {
            setScreen({ name: "landing" });
            return;
          }
          const nextIndex = currentPuzzleIndex + 1;
          const nextPuzzle = playlist[nextIndex];
          getSocket().emit(
            "host:startRound",
            { puzzle: nextPuzzle, isLastRound: nextIndex === playlist.length - 1 },
            () => {
              setCurrentPuzzleIndex(nextIndex);
              setRoundData({
                puzzleId: nextPuzzle.id,
                category: nextPuzzle.category,
                timeCapSeconds: nextPuzzle.timeCapSeconds,
                rows: toPublicRows(nextPuzzle.words),
                startedAt: Date.now(),
                isLastRound: nextIndex === playlist.length - 1,
              });
              setScreen({ name: "round", role: "host" });
            }
          );
        }}
      />
    );
  }
```

Add this branch for the player, right after it:

```tsx
  if (screen.name === "results" && screen.role === "player" && lastResults) {
    return (
      <ResultsPage
        results={lastResults.results}
        totals={lastResults.totals}
        role="player"
        isLastRound={roundData?.isLastRound ?? false}
        onNextRoundStarted={(payload) => {
          setRoundData(payload);
          setScreen({ name: "round", role: "player" });
        }}
      />
    );
  }
```

Add `getSocket` to the imports at the top of `App.tsx` (used directly here for the first time):

```ts
import { getSocket } from "./socket.js";
```

- [ ] **Step 6: Run the full client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — every client test file green.

- [ ] **Step 7: Manual verification**

Play a full 1-puzzle game end to end: host creates a room with one puzzle selected, a player joins and solves the chain (or lets the time cap expire).
Expected: both host and player land on a "Final Results 🏆" screen with confetti and the same point totals; the host sees an "End Session" button that returns to the landing screen. Repeat with a 2-puzzle playlist and confirm the first round shows "Round Results" / "Next Round" and correctly starts the second puzzle for everyone.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/ResultsPage.tsx client/src/App.tsx client/package.json client/tests/ResultsPage.test.tsx
git commit -m "Add ResultsPage with round/final leaderboard, confetti, and next-round flow"
```

---

## Task 31: End-to-end manual verification

Every prior task has its own automated tests and a narrow manual check. This task is a full run-through of the golden path and a few edge cases across three real browser windows, since no automated test exercises the whole stack together.

**Files:** none (no code changes expected; fix forward in the relevant task's files if something breaks)

- [ ] **Step 1: Start both dev servers**

```bash
npm run dev:server
```

In a second terminal:

```bash
npm run dev:client
```

- [ ] **Step 2: Individual-mode golden path**

Open three browser windows: one "host," two "players."
1. Host: click "Host a game" → select Individual mode → check 2 puzzles from the library → "Create Room".
2. Both players: "Join a game" → enter the room code shown on the host screen → enter distinct nicknames → "Join".
3. Confirm both nicknames appear live in the host's lobby list within ~1 second of joining.
4. Host: "Start Game".
5. Confirm both player tabs transition to the chain board within ~1 second, and the host's screen shows two mini-boards.
6. In one player tab, solve a couple of active-row blanks correctly — confirm cells turn green on that tab, on the host's mini-board grid, and that a wrong guess flashes a time penalty without breaking the board.
7. Click a hint 💡 button — confirm the tooltip text matches the spec and a letter is revealed in yellow.
8. Finish solving the full chain in one tab — confirm it shows "Solved!" while the other player tab is still active.
9. Let the second player finish or let the time cap expire — confirm `round:results` appears on all three windows with matching point totals, the faster finisher scoring 1000 and the other scoring proportionally less (or a partial-credit score if they didn't finish).
10. Host clicks "Next Round" — confirm the second puzzle starts on all three windows and running point totals (not just this round's points) are reflected correctly after the round ends.
11. After the second (final) puzzle ends, confirm all three windows show "Final Results 🏆" with confetti on the host and both player screens, and the host sees "End Session".

- [ ] **Step 3: Team-mode golden path**

Repeat with Team mode and two team names, two players joining the same team.
Expected: both players see the identical live board; solving a row from either device updates both instantly; the host's mini-board grid shows one board per team, not per player.

- [ ] **Step 4: Presence edge case**

Mid-round, close one player's browser tab entirely (not a graceful "leave").
Expected: the host's lobby/round view marks that player as disconnected rather than silently vanishing (per Task 18); reopening the join page with the same room code and nickname within the grace period resumes their in-progress board rather than creating a duplicate entrant.

- [ ] **Step 5: Record and fix any gaps found**

If any step above doesn't match its expected behavior, identify which task's files are responsible, fix them directly, re-run that task's automated tests, and repeat this manual pass for the affected step. Do not consider the plan complete until all steps above pass.

---

## Task 32: Custom puzzle creator

The design spec calls for a curated library **and** a custom creator (Task 25 only built the library picker). This adds a form for hosts to author their own chains, validated with the same `validatePuzzleWords` the library itself is checked against, and persisted to `localStorage` so a host's custom puzzles survive a page reload on that device (per the design's no-accounts, per-device persistence model).

**Files:**
- Create: `client/src/customPuzzles.ts`
- Test: `client/tests/customPuzzles.test.ts`
- Create: `client/src/pages/CustomPuzzleCreatorPage.tsx`
- Test: `client/tests/CustomPuzzleCreatorPage.test.tsx`
- Modify: `client/src/pages/HostSetupPage.tsx` (merge custom puzzles into the pickable list, add a way to open the creator)
- Modify: `client/src/App.tsx` (add a `customPuzzleCreator` screen)

**Interfaces:**
- Consumes: `validatePuzzleWords` (Task 5), `Puzzle` type (Task 2)
- Produces: `loadCustomPuzzles(): Puzzle[]`, `saveCustomPuzzle(puzzle: Puzzle): void` (both backed by `localStorage`); `CustomPuzzleCreatorPage` (props: `onSaved: () => void`, `onCancel: () => void`).

- [ ] **Step 1: Write the failing storage test**

Create `client/tests/customPuzzles.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadCustomPuzzles, saveCustomPuzzle } from "../src/customPuzzles.js";

describe("custom puzzle storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    expect(loadCustomPuzzles()).toEqual([]);
  });

  it("persists a saved puzzle and returns it on reload", () => {
    const puzzle = { id: "custom-1", category: "My Puzzle", difficulty: "easy" as const, words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 };
    saveCustomPuzzle(puzzle);
    expect(loadCustomPuzzles()).toEqual([puzzle]);
  });

  it("appends rather than overwrites when saving multiple puzzles", () => {
    saveCustomPuzzle({ id: "c1", category: "A", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 });
    saveCustomPuzzle({ id: "c2", category: "B", difficulty: "easy", words: ["SUN", "FLOWER", "BED"], timeCapSeconds: 60 });
    expect(loadCustomPuzzles()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/customPuzzles.js'`

- [ ] **Step 3: Implement customPuzzles.ts**

```ts
// client/src/customPuzzles.ts

import type { Puzzle } from "@wordchain/shared";

const STORAGE_KEY = "wordchain:customPuzzles";

export function loadCustomPuzzles(): Puzzle[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Puzzle[]) : [];
}

export function saveCustomPuzzle(puzzle: Puzzle): void {
  const existing = loadCustomPuzzles();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, puzzle]));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Write the failing creator page test**

Create `client/tests/CustomPuzzleCreatorPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomPuzzleCreatorPage } from "../src/pages/CustomPuzzleCreatorPage.js";
import { loadCustomPuzzles } from "../src/customPuzzles.js";

describe("CustomPuzzleCreatorPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a validation error instead of saving an invalid chain", async () => {
    render(<CustomPuzzleCreatorPage onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/category/i), "My Category");
    await userEvent.type(screen.getByLabelText(/words/i), "HOT, HOT, KICK");
    await userEvent.click(screen.getByRole("button", { name: /save puzzle/i }));
    expect(await screen.findByText(/identical/i)).toBeInTheDocument();
    expect(loadCustomPuzzles()).toEqual([]);
  });

  it("saves a valid chain and calls onSaved", async () => {
    const onSaved = vi.fn();
    render(<CustomPuzzleCreatorPage onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/category/i), "My Category");
    await userEvent.type(screen.getByLabelText(/words/i), "HOT, DOG, KICK");
    await userEvent.click(screen.getByRole("button", { name: /save puzzle/i }));
    expect(onSaved).toHaveBeenCalled();
    expect(loadCustomPuzzles()).toHaveLength(1);
    expect(loadCustomPuzzles()[0].words).toEqual(["HOT", "DOG", "KICK"]);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `Cannot find module '../src/pages/CustomPuzzleCreatorPage.js'`

- [ ] **Step 7: Implement CustomPuzzleCreatorPage.tsx**

```tsx
// client/src/pages/CustomPuzzleCreatorPage.tsx

import { useState } from "react";
import { validatePuzzleWords } from "@wordchain/shared";
import { saveCustomPuzzle } from "../customPuzzles.js";

export interface CustomPuzzleCreatorPageProps {
  onSaved: () => void;
  onCancel: () => void;
}

export function CustomPuzzleCreatorPage({ onSaved, onCancel }: CustomPuzzleCreatorPageProps) {
  const [category, setCategory] = useState("");
  const [wordsInput, setWordsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const words = wordsInput
      .split(",")
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length > 0);

    const errors = validatePuzzleWords(words);
    if (errors.length > 0) {
      setError(errors[0].message);
      return;
    }

    saveCustomPuzzle({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: category.trim() || "Custom",
      difficulty: "medium",
      words,
      timeCapSeconds: 90,
    });
    onSaved();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-2xl text-white font-extrabold">Create a puzzle</h1>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Category
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Words (comma separated, first and last are the clues)
          <textarea
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={wordsInput}
            onChange={(e) => setWordsInput(e.target.value)}
            placeholder="HOT, DOG, TAG, ALONG, SIDE, KICK"
          />
        </label>
        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-6 py-2 font-display font-extrabold text-chain-locked"
          >
            Save Puzzle
          </button>
          <button type="button" onClick={onCancel} className="text-chain-locked/60 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 9: Merge custom puzzles into HostSetupPage and wire the creator into App.tsx**

Modify `client/src/pages/HostSetupPage.tsx`: add `import { loadCustomPuzzles } from "../customPuzzles.js";` and replace the puzzle checklist's data source. Change:

```ts
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

to also track the combined list:

```ts
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customPuzzles, setCustomPuzzles] = useState(() => loadCustomPuzzles());
  const allPuzzles = [...PUZZLE_LIBRARY, ...customPuzzles];
```

Replace every use of `PUZZLE_LIBRARY` in the render and in `handleCreateRoom`'s `.filter(...)` with `allPuzzles`. Add an `onOpenCreator: () => void` prop and a button that calls it, placed above the puzzle checklist:

```tsx
        <button type="button" onClick={onOpenCreator} className="text-chain-purple text-sm font-semibold underline self-start">
          + Create a custom puzzle
        </button>
```

Add `onOpenCreator: () => void;` to `HostSetupPageProps` and thread it through the function signature.

In `client/src/App.tsx`, add the import and a `customPuzzleCreator` screen. Add to the `Screen` union:

```ts
  | { name: "customPuzzleCreator" };
```

Add the import:

```ts
import { CustomPuzzleCreatorPage } from "./pages/CustomPuzzleCreatorPage.js";
```

Update the `hostSetup` branch to pass `onOpenCreator`:

```tsx
  if (screen.name === "hostSetup") {
    return (
      <HostSetupPage
        onOpenCreator={() => setScreen({ name: "customPuzzleCreator" })}
        onRoomCreated={(data) => {
          setRoomCode(data.code);
          setMode(data.mode);
          setPlaylist(data.playlist);
          setScreen({ name: "hostLobby" });
        }}
      />
    );
  }
```

Add a new branch for it:

```tsx
  if (screen.name === "customPuzzleCreator") {
    return (
      <CustomPuzzleCreatorPage
        onSaved={() => setScreen({ name: "hostSetup" })}
        onCancel={() => setScreen({ name: "hostSetup" })}
      />
    );
  }
```

- [ ] **Step 10: Run the full client suite and manually verify**

Run: `npm run test --workspace=client`
Expected: PASS.

Run: `npm run dev --workspace=client`, click "Host a game" → "+ Create a custom puzzle" → fill in a category and a valid word chain → "Save Puzzle".
Expected: returns to setup with the new puzzle checkable in the list; reloading the page keeps it available (persisted to `localStorage`).

- [ ] **Step 11: Commit**

```bash
git add client/src/customPuzzles.ts client/tests/customPuzzles.test.ts client/src/pages/CustomPuzzleCreatorPage.tsx client/tests/CustomPuzzleCreatorPage.test.tsx client/src/pages/HostSetupPage.tsx client/src/App.tsx
git commit -m "Add custom puzzle creator with localStorage persistence"
```

---

## Task 33: Team "someone is typing" indicator

Per the design spec's Team Mode section: when a teammate has text entered in a row, other teammates should see a small "✏️ Jamie is typing…" indicator on that row. This is a fire-and-forget presence signal, not a request/response action, so it uses a plain (no-ack) socket event.

**Files:**
- Modify: `server/src/socket/registerRoundPlayHandlers.ts` (add `player:typing`)
- Modify: `server/tests/registerRoundPlayHandlers.test.ts` (add a test)
- Modify: `client/src/components/ChainBoard.tsx` (emit while typing, render an incoming indicator)
- Modify: `client/tests/ChainBoard.test.tsx` (add tests)
- Modify: `client/src/pages/PlayerRoundPage.tsx` (wire the socket event to `ChainBoard`)

**Interfaces:**
- Consumes: `resolveActiveRoom` (Task 15, same file), `getSocket` (Task 20)
- Produces: event `"player:typing"` payload `{ rowIndex: number }` (no ack); broadcast `"board:typing"` payload `{ entrantId: string; nickname: string; rowIndex: number }` to everyone else in the room; `ChainBoard` gains `onTyping?: (rowIndex: number, value: string) => void` and `typingIndicator?: { rowIndex: number; nickname: string } | null` props.

- [ ] **Step 1: Add the failing server test**

Append to `server/tests/registerRoundPlayHandlers.test.ts`, as a new `describe` block:

```ts
describe("player:typing", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("broadcasts to teammates but not back to the sender", async () => {
    const { player, teammate } = await setupActiveRound("team");
    cleanup = () => {};

    const teammateEventPromise = new Promise<{ entrantId: string; nickname: string; rowIndex: number }>((resolve) => {
      teammate!.once("board:typing", resolve);
    });
    let senderReceivedIt = false;
    player.once("board:typing", () => {
      senderReceivedIt = true;
    });

    player.emit("player:typing", { rowIndex: 1 });

    const event = await teammateEventPromise;
    expect(event).toMatchObject({ entrantId: "t1", nickname: "Alex", rowIndex: 1 });
    expect(senderReceivedIt).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — no `board:typing` event ever arrives (timeout).

- [ ] **Step 3: Add the handler to registerRoundPlayHandlers.ts**

Add this inside `registerRoundPlayHandlers`, after the `player:useHint` handler:

```ts
  socket.on("player:typing", (payload: { rowIndex: number }) => {
    const room = resolveActiveRoom(socket, roomManager);
    if (!room) return;
    let entrantId: string;
    try {
      entrantId = room.getEntrantId(socket.id);
    } catch {
      return;
    }
    const player = room.getPlayers().find((p) => p.socketId === socket.id);
    socket.to(room.code).emit("board:typing", {
      entrantId,
      nickname: player?.nickname ?? "Someone",
      rowIndex: payload.rowIndex,
    });
  });
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 5: Add the failing ChainBoard tests**

Append to `client/tests/ChainBoard.test.tsx`:

```tsx
it("calls onTyping with the row index and current value as the user types", async () => {
  const onTyping = vi.fn();
  render(
    <ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={vi.fn()} onTyping={onTyping} />
  );
  await userEvent.type(screen.getByLabelText("Guess for row 1"), "D");
  expect(onTyping).toHaveBeenCalledWith(1, "D");
});

it("shows a typing indicator for the given row", () => {
  render(
    <ChainBoard
      rows={ROWS}
      boardView={INITIAL_VIEW}
      onSubmitGuess={vi.fn()}
      onHint={vi.fn()}
      typingIndicator={{ rowIndex: 4, nickname: "Jamie" }}
    />
  );
  expect(screen.getByText("✏️ Jamie is typing…")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — `onTyping`/`typingIndicator` are not accepted props yet.

- [ ] **Step 7: Add the props to ChainBoard.tsx**

Update the props interface and `handleChange`:

```ts
export interface ChainBoardProps {
  rows: PublicChainRow[];
  boardView: PublicBoardView;
  onSubmitGuess: (rowIndex: number, guess: string) => void;
  onHint: (rowIndex: number) => void;
  onTyping?: (rowIndex: number, value: string) => void;
  typingIndicator?: { rowIndex: number; nickname: string } | null;
}
```

```ts
export function ChainBoard({ rows, boardView, onSubmitGuess, onHint, onTyping, typingIndicator }: ChainBoardProps) {
  const [typedByRow, setTypedByRow] = useState<Record<number, string>>({});
  const activeRows = getActiveRowsFromBounds(boardView.topSolved, boardView.bottomSolved);

  function handleChange(rowIndex: number, value: string, length: number) {
    const normalized = value.toUpperCase().slice(0, length);
    setTypedByRow((prev) => ({ ...prev, [rowIndex]: normalized }));
    onTyping?.(rowIndex, normalized);
  }
```

Add the indicator's rendering inside the row's wrapper `<div key={row.index} ...>`, right after the `{isActive && (<input .../>)}` block:

```tsx
            {typingIndicator?.rowIndex === row.index && (
              <span className="text-white/90 text-xs italic">✏️ {typingIndicator.nickname} is typing…</span>
            )}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 9: Wire it into PlayerRoundPage.tsx**

Add state and a socket listener, and pass the new props to `ChainBoard`. Update the imports:

```ts
import { useEffect, useState } from "react";
```

Add this state alongside the existing ones in `PlayerRoundPage`:

```ts
  const [typingIndicator, setTypingIndicator] = useState<{ rowIndex: number; nickname: string } | null>(null);
```

Inside the existing socket `useEffect`, add a handler and clear-timeout logic:

```ts
    let typingTimeout: ReturnType<typeof setTimeout> | undefined;
    function handleTyping(payload: { entrantId: string; nickname: string; rowIndex: number }) {
      if (payload.entrantId !== myEntrantId) return;
      setTypingIndicator({ rowIndex: payload.rowIndex, nickname: payload.nickname });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTypingIndicator(null), 2000);
    }
    socket.on("board:typing", handleTyping);
```

Add `socket.off("board:typing");` and `clearTimeout(typingTimeout);` to the effect's cleanup function alongside the existing `socket.off(...)` calls.

Add a `handleTyping` emitter function next to `handleSubmitGuess`/`handleHint`:

```ts
  function handleTyping(rowIndex: number) {
    getSocket().emit("player:typing", { rowIndex });
  }
```

Pass the new props to `ChainBoard`:

```tsx
        <ChainBoard
          rows={roundData.rows}
          boardView={boardView}
          onSubmitGuess={handleSubmitGuess}
          onHint={handleHint}
          onTyping={handleTyping}
          typingIndicator={typingIndicator}
        />
```

- [ ] **Step 10: Manual verification**

With two players joined to the same team (Task 31's team-mode check), have one type into an active row without submitting.
Expected: the other teammate's screen shows "✏️ [name] is typing…" next to that row within a second, and it disappears within ~2 seconds of the first player pausing.

- [ ] **Step 11: Commit**

```bash
git add server/src/socket/registerRoundPlayHandlers.ts server/tests/registerRoundPlayHandlers.test.ts client/src/components/ChainBoard.tsx client/tests/ChainBoard.test.tsx client/src/pages/PlayerRoundPage.tsx
git commit -m "Add team typing indicator"
```

---

## Task 34: Sound toggle control

Task 21 built `isSoundEnabled`/`setSoundEnabled`/`playTone`, but nothing in the UI actually lets a player flip the setting. This adds the missing toggle button to the one screen where sound plays — `PlayerRoundPage`.

**Files:**
- Modify: `client/src/pages/PlayerRoundPage.tsx`
- Modify: `client/tests/PlayerRoundPage.test.tsx`

**Interfaces:**
- Consumes: `isSoundEnabled`/`setSoundEnabled` (Task 21)
- Produces: a 🔊/🔇 toggle button rendered in `PlayerRoundPage`'s header row.

- [ ] **Step 1: Add the failing test**

Append to `client/tests/PlayerRoundPage.test.tsx`:

```tsx
it("toggles the sound setting and updates the button label", async () => {
  render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
  const toggle = screen.getByRole("button", { name: /🔊|🔇/ });
  expect(toggle).toHaveTextContent("🔊");
  await userEvent.click(toggle);
  expect(toggle).toHaveTextContent("🔇");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace=client`
Expected: FAIL — no button with that accessible name exists yet.

- [ ] **Step 3: Add the toggle to PlayerRoundPage.tsx**

Update the import line:

```ts
import { isSoundEnabled, playTone, setSoundEnabled } from "../sound.js";
```

Add state alongside the existing ones:

```ts
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
```

Add this button inside the header `<div className="flex items-center justify-between ...">`, after the elapsed-time `<span>`:

```tsx
        <button
          type="button"
          onClick={() => {
            const next = !soundOn;
            setSoundEnabled(next);
            setSoundOn(next);
          }}
          className="text-xl"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `npm run dev --workspace=client`, join a round, click the 🔊 icon.
Expected: it switches to 🔇 and subsequent correct/wrong/hint actions play no sound; clicking again restores sound.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/PlayerRoundPage.tsx client/tests/PlayerRoundPage.test.tsx
git commit -m "Add sound on/off toggle to the player round screen"
```

---

## Task 35: Public deployment (Vercel client + Render server)

The design spec requires public deployment from the start so players can join from anywhere, not just the host's local network. This task makes the CORS origin configurable (it's hardcoded to `"*"` from Task 10, which works but is worth tightening once a real client domain exists) and deploys both halves.

**Files:**
- Modify: `server/src/index.ts` (configurable CORS origin)
- Create: `server/.env.example`
- Create: `client/.env.example`
- Create: `client/vercel.json`

**Interfaces:**
- Consumes: nothing new
- Produces: a public backend URL (Render) and a public frontend URL (Vercel) that talk to each other in production.

- [ ] **Step 1: Make the CORS origin configurable**

In `server/src/index.ts`, change:

```ts
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
```

to:

```ts
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? "*" },
  });
```

- [ ] **Step 2: Add environment variable examples**

Create `server/.env.example`:

```
PORT=3001
CLIENT_ORIGIN=https://your-word-chain-app.vercel.app
```

Create `client/.env.example`:

```
VITE_SERVER_URL=https://your-word-chain-server.onrender.com
```

- [ ] **Step 3: Add a Vercel config so client routing works on refresh**

Create `client/vercel.json` (the app is a single-page app with no server-side routes, so every path must fall back to `index.html`):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 4: Deploy the server to Render**

1. Push the repository to GitHub (if not already).
2. In the Render dashboard: New → Web Service → connect the repo.
3. Root directory: `server`. Build command: `npm install --workspace=server --include-workspace-root`. Start command: `npm run dev --workspace=server` is for local dev only — for production add a `"start": "tsx src/index.ts"` script to `server/package.json` and use `npm run start --workspace=server` as Render's start command instead.
4. Set environment variables from `server/.env.example` (`PORT` is provided by Render automatically — omit it; set `CLIENT_ORIGIN` once the Vercel URL from Step 5 is known).
5. Deploy and note the resulting `https://*.onrender.com` URL.

- [ ] **Step 5: Deploy the client to Vercel**

1. In the Vercel dashboard: New Project → import the same repo.
2. Root directory: `client`. Framework preset: Vite (auto-detected).
3. Set the environment variable `VITE_SERVER_URL` to the Render URL from Step 4.
4. Deploy and note the resulting `https://*.vercel.app` URL.
5. Go back to Render and set `CLIENT_ORIGIN` to that Vercel URL, then redeploy the server so CORS allows it.

- [ ] **Step 6: Manual verification**

From a phone on a different network than your computer (e.g., cellular data, not the same WiFi), open the Vercel URL, join a room hosted from your computer's browser.
Expected: the join succeeds and the round plays normally end-to-end — this confirms the deployment (not just localhost) actually works for a remote player, fulfilling the "needs public deployment from the start" requirement.

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts server/.env.example client/.env.example client/vercel.json server/package.json
git commit -m "Configure CORS and add deployment configuration for Render + Vercel"
```

---

## Task 36: Resume mid-round view on reconnect

Task 18 preserves a reconnecting player's board *state* server-side, but the client never learns a round is already in progress — a reconnecting player would sit on the lobby screen forever waiting for a `round:started` event that already fired before they reconnected. This closes that gap: the join/reconnect ack now includes the active round (if any) and the player's own in-progress board, so the client can jump straight back into it.

**Files:**
- Modify: `server/src/rooms/Room.ts` (store `isLastRound` on `currentRound` so it can be recalled later)
- Modify: `server/tests/Room.test.ts` (update the `startRound` test call sites)
- Modify: `server/src/socket/registerHostRoundHandlers.ts` (pass `isLastRound` into `room.startRound`)
- Modify: `server/src/socket/registerPlayerHandlers.ts` (include `activeRound`/`boardView` in the join ack when reconnecting mid-round)
- Modify: `server/tests/registerPlayerHandlers.test.ts` (add a test)
- Modify: `client/src/pages/JoinPage.tsx` (surface the new ack fields)
- Modify: `client/tests/JoinPage.test.tsx`
- Modify: `client/src/pages/PlayerRoundPage.tsx` (accept an optional starting board view)
- Modify: `client/src/App.tsx` (route straight to the round screen on a mid-round reconnect)

- [ ] **Step 1: Update Room to remember isLastRound**

In `server/src/rooms/Room.ts`, add `isLastRound: boolean;` to the `RoundState` interface, and change `startRound`'s signature and final line:

```ts
  startRound(puzzle: Puzzle, isLastRound = false): void {
```

```ts
    this.currentRound = { puzzle, startedAt: Date.now(), entrantChains, finishedAt: new Map(), isLastRound };
```

Update every `room.startRound(PUZZLE)` call across `server/tests/Room.test.ts` and `server/tests/scoreRound.test.ts` — no change needed, since `isLastRound` now defaults to `false` and those tests don't care about it.

- [ ] **Step 2: Run the server tests to confirm nothing broke**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 3: Pass isLastRound through from host:startRound**

In `server/src/socket/registerHostRoundHandlers.ts`, change:

```ts
      room.startRound(payload.puzzle);
```

to:

```ts
      room.startRound(payload.puzzle, payload.isLastRound ?? false);
```

- [ ] **Step 4: Write the failing reconnect-with-active-round test**

Append to `server/tests/registerPlayerHandlers.test.ts` (new `it` inside `describe("player:joinRoom", ...)`):

```ts
  it("includes the active round and the player's own board when reconnecting mid-round", async () => {
    const { url, code, roomManager } = await setup();
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve())
    );

    const room = roomManager.getRoom(code)!;
    room.startRound({ id: "p1", category: "Test", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 }, false);
    room.setConnected(firstConnection.id!, false);
    firstConnection.close();

    const secondConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => secondConnection.on("connect", resolve));
    const response = await new Promise<{
      success: boolean;
      activeRound?: { puzzleId: string };
      boardView?: { topSolved: number };
    }>((resolve) => {
      secondConnection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.activeRound?.puzzleId).toBe("p1");
    expect(response.boardView?.topSolved).toBe(0);
    secondConnection.close();
  });
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm run test --workspace=server`
Expected: FAIL — `response.activeRound` is `undefined`.

- [ ] **Step 6: Include the active round in the join/reconnect ack**

In `server/src/socket/registerPlayerHandlers.ts`, add this import:

```ts
import { toPublicBoardView, toPublicRows } from "@wordchain/shared";
```

Add this helper function above `registerPlayerHandlers`:

```ts
function buildActiveRoundAck(room: import("../rooms/Room.js").Room, entrantId: string) {
  if (!room.currentRound) return {};
  const chainState = room.currentRound.entrantChains.get(entrantId);
  if (!chainState) return {};
  return {
    activeRound: {
      puzzleId: room.currentRound.puzzle.id,
      category: room.currentRound.puzzle.category,
      timeCapSeconds: room.currentRound.puzzle.timeCapSeconds,
      rows: toPublicRows(room.currentRound.puzzle.words),
      startedAt: room.currentRound.startedAt,
      isLastRound: room.currentRound.isLastRound,
    },
    boardView: toPublicBoardView(chainState),
  };
}
```

Update both success paths in the `player:joinRoom` handler to spread it in:

```ts
        callback({ success: true, mode: room.mode, teams: room.teams, ...buildActiveRoundAck(room, room.getEntrantId(socket.id)) });
        return;
```

(replacing the reconnect branch's `callback({ success: true, mode: room.mode, teams: room.teams });`), and:

```ts
      callback({ success: true, mode: room.mode, teams: room.teams, ...buildActiveRoundAck(room, room.getEntrantId(socket.id)) });
```

(replacing the fresh-join branch's equivalent line). Since `getEntrantId` needs the player to already be added to `room.players` first, call it after `room.addPlayer(...)`/after the reconnect, which both branches already do by this point in the function.

- [ ] **Step 7: Run it to verify it passes**

Run: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 8: Surface it on the client's JoinPage**

In `client/src/pages/JoinPage.tsx`, extend `JoinedData`:

```ts
export interface JoinedData {
  nickname: string;
  mode: "individual" | "team";
  teams: { id: string; name: string }[];
  activeRound?: { puzzleId: string; category: string; timeCapSeconds: number; rows: unknown[]; startedAt: number; isLastRound: boolean };
  boardView?: { topSolved: number; bottomSolved: number; revealedText: Record<number, string>; penaltySeconds: number };
}
```

Update the `onJoined` call inside `handleJoin` to forward the new fields:

```ts
          onJoined({
            nickname: nickname.trim(),
            mode: response.mode,
            teams: response.teams,
            activeRound: response.activeRound,
            boardView: response.boardView,
          });
```

Add a test to `client/tests/JoinPage.test.tsx` asserting the extra fields pass through when present (mock the ack with `activeRound`/`boardView` populated and assert `onJoined` received them).

- [ ] **Step 9: Accept a starting board view in PlayerRoundPage**

In `client/src/pages/PlayerRoundPage.tsx`, add an optional prop and use it instead of always computing a fresh one:

```ts
export interface PlayerRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  myTeamId: string | null;
  initialBoardView?: PublicBoardView;
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}
```

```ts
  const [boardView, setBoardView] = useState<PublicBoardView>(
    () => initialBoardView ?? computeInitialBoardView(roundData.rows)
  );
```

Rename the existing standalone `initialBoardView` function to `computeInitialBoardView` to avoid shadowing the new prop name.

- [ ] **Step 10: Route straight into the round on a mid-round reconnect**

In `client/src/App.tsx`, update the `join` branch (from Task 27) to check for `activeRound`:

```tsx
  if (screen.name === "join") {
    return (
      <JoinPage
        onJoined={(data) => {
          setNickname(data.nickname);
          setMode(data.mode);
          setTeams(data.teams);
          if (data.activeRound) {
            setRoundData(data.activeRound as RoundStartedPayload);
            setReconnectBoardView(data.boardView as PublicBoardView);
            setScreen({ name: "round", role: "player" });
          } else {
            setScreen({ name: "playerLobby" });
          }
        }}
      />
    );
  }
```

Add the new state and import alongside the others:

```ts
  const [reconnectBoardView, setReconnectBoardView] = useState<PublicBoardView | null>(null);
```

```ts
import type { PublicBoardView } from "@wordchain/shared";
```

Update the player `round` branch (from Task 28) to pass it through and clear it after use:

```tsx
  if (screen.name === "round" && screen.role === "player" && roundData) {
    return (
      <PlayerRoundPage
        roundData={roundData}
        mode={mode}
        myTeamId={myTeamId}
        initialBoardView={reconnectBoardView ?? undefined}
        onResults={(payload) => {
          setReconnectBoardView(null);
          setLastResults(payload);
          setScreen({ name: "results", role: "player" });
        }}
      />
    );
  }
```

- [ ] **Step 11: Run the full test suite**

Run: `npm run test --workspace=shared && npm run test --workspace=server && npm run test --workspace=client`
Expected: PASS across all three packages.

- [ ] **Step 12: Manual verification**

Repeat Task 31 Step 4 (close a player's tab mid-round), but this time reload the join page and rejoin with the same nickname before the grace period expires.
Expected: the player lands directly back on the chain board with their previously-solved rows already shown green, instead of being stuck on the lobby screen.

- [ ] **Step 13: Commit**

```bash
git add server/src/rooms/Room.ts server/src/socket/registerHostRoundHandlers.ts server/src/socket/registerPlayerHandlers.ts server/tests/registerPlayerHandlers.test.ts client/src/pages/JoinPage.tsx client/tests/JoinPage.test.tsx client/src/pages/PlayerRoundPage.tsx client/src/App.tsx
git commit -m "Resume a reconnecting player directly into their in-progress round"
```

---

## Deliberately deferred (not in this plan)

- **Lobby ambient/background music** (design spec, Host View section): needs a licensed audio asset, which this plan has no source for. `sound.ts` (Task 21) already establishes the Web-Audio-API pattern for synthesized effects if a simple loop is added later; a real music bed should be sourced and added as a follow-up.
- **Actual Redis-backed scaling** beyond dozens of concurrent players: explicitly out of scope per the design spec.

This completes the plan.
