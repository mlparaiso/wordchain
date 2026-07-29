# Word Chain Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing "Word Chain" client visual/tactile depth (bevels, shadows, a real chain-link motif, a shared Button/IconButton system, a real podium moment) across every player and host screen, per `docs/superpowers/specs/2026-07-29-word-chain-visual-redesign-design.md` — with zero changes to game logic, socket handlers, or the `shared` package.

**Architecture:** Two new shared components (`Button`, `IconButton`) absorb the ad-hoc button markup duplicated across pages. `LetterCell` and `ChainLink` get a bevel/badge treatment. Every page then gets a small, mechanical migration to use the new shared components, plus targeted polish (podium on `ResultsPage`, elevated panels on `HostRoundPage`, a badge-style elapsed-time display).

**Tech Stack:** React 19 + TypeScript + Tailwind CSS (utility classes, arbitrary values for one-off shadows — matches existing codebase convention) + Vitest/React Testing Library.

## Global Constraints

- No changes to `ChainState`, socket events, server code, or `@wordchain/shared` — CSS/markup/component-structure only.
- Keep the existing brand palette (`chain-purple` `#6C5CE7`, `chain-pink` `#FF6B9D`, `chain-yellow` `#FFD93D`/shadow `#e0b800`, `chain-green` `#4CD964`, `chain-locked` `#2d2d3a`) — depth comes from shadows/gradients of these, not new brand hues. (Medal emoji 🥇🥈🥉 in the podium task are the one narrow exception, called for explicitly by the spec's "Results screens" section — no new hex colors are introduced for them.)
- No accessibility regression: every state that currently conveys meaning via color alone keeps a non-color signal too (shape, icon, or the letter content itself).
- Every existing Vitest test must keep passing. Tests assert on `data-testid`/`data-state`/role/text/click-handlers, not exact Tailwind class strings, so treatment-only changes should not require test changes — if a task discovers a test that does assert exact classes, update that test in the same task.
- `npm run build --workspace=client` and `npm run test --workspace=client` must pass at the end.

---

## File Structure

- `client/src/components/Button.tsx` — new shared CTA button (variants: `primary`, `secondary`, `outline`, `ghost`; sizes: `sm`, `md`).
- `client/src/components/IconButton.tsx` — new shared circular icon button (hint, mute, etc.).
- `client/src/components/LetterCell.tsx` — bevel treatment per state, existing states/props/testids unchanged.
- `client/src/components/ChainLink.tsx` — visible circular badge treatment, existing states/props/testids unchanged.
- `client/src/components/ChainRow.tsx` — hint button now renders via `IconButton`.
- `client/tailwind.config.js` — add a `tile-pop` keyframe/animation alongside the existing `penalty-float` one.
- `client/src/App.tsx` — landing screen: `Button` component + a decorative chain-link background layer + the existing `pwa-icon.svg` chain glyph as a hero graphic.
- `client/src/pages/JoinPage.tsx`, `HostSetupPage.tsx`, `PlayerLobbyPage.tsx`, `SoloDifficultyPage.tsx` — CTA buttons migrated to `Button`.
- `client/src/pages/HostLobbyPage.tsx`, `HostRoundPage.tsx`, `CustomPuzzleCreatorPage.tsx` — CTA buttons migrated to `Button` (including an `outline`-variant "End Round").
- `client/src/pages/ResultsPage.tsx` — top-3 podium treatment (medal emoji + highlight band) on the leaderboard, button migrated to `Button`.
- `client/src/pages/SoloResultsPage.tsx` — buttons migrated to `Button`, stat card gets a shadow to match other white panels.
- `client/src/pages/HostRoundPage.tsx` — entrant board panels get elevation (shadow), progress boxes get a bevel on the solved state, elapsed-time display becomes a badge.
- `client/src/pages/PlayerRoundPage.tsx`, `SoloRoundPage.tsx` — elapsed-time display becomes a badge (same treatment as `HostRoundPage`).

---

## Task 1: Tailwind animation + shared `Button` component

**Files:**
- Modify: `client/tailwind.config.js`
- Create: `client/src/components/Button.tsx`
- Test: `client/tests/Button.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `Button` component with props `{ variant?: "primary" | "secondary" | "outline" | "ghost"; size?: "sm" | "md" }` (plus all native `<button>` props via spread) — consumed by Task 6 (landing) and Tasks 7-10 (page migrations). Also produces the `animate-tile-pop` Tailwind utility, consumed by Task 3.

- [ ] **Step 1: Add the `tile-pop` keyframe/animation to tailwind.config.js**

Modify `client/tailwind.config.js` — the `keyframes` and `animation` objects currently contain only `penalty-float`. Add `tile-pop` alongside it:

```js
      keyframes: {
        "penalty-float": {
          "0%": { opacity: "0", transform: "translateY(0)" },
          "15%": { opacity: "1", transform: "translateY(-4px)" },
          "80%": { opacity: "1", transform: "translateY(-14px)" },
          "100%": { opacity: "0", transform: "translateY(-22px)" },
        },
        "tile-pop": {
          "0%": { transform: "scale(0.85)" },
          "60%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "penalty-float": "penalty-float 1.1s ease-out forwards",
        "tile-pop": "tile-pop 220ms ease-out",
      },
```

- [ ] **Step 2: Write the failing test for Button**

Create `client/tests/Button.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../src/components/Button.js";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Host a game</Button>);
    expect(screen.getByText("Host a game")).toBeInTheDocument();
  });

  it("defaults to the primary variant", () => {
    render(<Button>Go</Button>);
    expect(screen.getByTestId("button")).toHaveAttribute("data-variant", "primary");
  });

  it("applies the requested variant", () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByTestId("button")).toHaveAttribute("data-variant", "secondary");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByText("Go"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>
    );
    await userEvent.click(screen.getByText("Go"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=client -- Button.test.tsx`
Expected: FAIL — `Cannot find module '../src/components/Button.js'`

- [ ] **Step 4: Implement Button.tsx**

Create `client/src/components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-chain-yellow text-chain-locked shadow-[0_4px_0_#e0b800] active:shadow-[0_1px_0_#e0b800] active:translate-y-[3px]",
  secondary:
    "bg-white text-chain-locked shadow-[0_4px_0_#cccccc] active:shadow-[0_1px_0_#cccccc] active:translate-y-[3px]",
  outline: "bg-white/20 border-2 border-white text-white shadow-none active:bg-white/30",
  ghost: "bg-transparent text-white/80 underline shadow-none",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-1 text-sm",
  md: "px-6 py-3",
};

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  const base =
    variant === "ghost"
      ? "text-sm font-semibold"
      : `rounded-full font-display font-extrabold transition-transform duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${SIZE_CLASSES[size]}`;

  return (
    <button
      type="button"
      data-testid="button"
      data-variant={variant}
      className={`${base} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=client -- Button.test.tsx`
Expected: PASS — all 5 `Button` tests green.

- [ ] **Step 6: Commit**

```bash
git add client/tailwind.config.js client/src/components/Button.tsx client/tests/Button.test.tsx
git commit -m "Add tile-pop animation and shared Button component"
```

---

## Task 2: Shared `IconButton` component

**Files:**
- Create: `client/src/components/IconButton.tsx`
- Test: `client/tests/IconButton.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `IconButton` component (all native `<button>` props via spread) — consumed by Task 5 (`ChainRow`'s hint button).

- [ ] **Step 1: Write the failing tests**

Create `client/tests/IconButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "../src/components/IconButton.js";

describe("IconButton", () => {
  it("renders its children", () => {
    render(<IconButton>💡</IconButton>);
    expect(screen.getByText("💡")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<IconButton onClick={onClick}>💡</IconButton>);
    await userEvent.click(screen.getByTestId("icon-button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards a title attribute for tooltips", () => {
    render(<IconButton title="Reveal a letter">💡</IconButton>);
    expect(screen.getByTestId("icon-button")).toHaveAttribute("title", "Reveal a letter");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=client -- IconButton.test.tsx`
Expected: FAIL — `Cannot find module '../src/components/IconButton.js'`

- [ ] **Step 3: Implement IconButton.tsx**

Create `client/src/components/IconButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function IconButton({ className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      data-testid="icon-button"
      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/25 border-2 border-white shadow-[0_3px_0_rgba(0,0,0,0.15)] flex items-center justify-center text-base sm:text-lg transition-transform duration-100 active:shadow-none active:translate-y-[3px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=client -- IconButton.test.tsx`
Expected: PASS — all 3 `IconButton` tests green.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/IconButton.tsx client/tests/IconButton.test.tsx
git commit -m "Add shared IconButton component"
```

---

## Task 3: Redesign `LetterCell` bevel treatment

**Files:**
- Modify: `client/src/components/LetterCell.tsx`

**Interfaces:**
- Consumes: `animate-tile-pop` (Task 1)
- Produces: no interface change — same `LetterCellProps`/`LetterCellState`/`data-testid`/`data-state` as before, consumed by `ChainRow` (unchanged) and every existing test.

- [ ] **Step 1: Confirm the existing test still describes the contract**

Run: `npm run test --workspace=client -- LetterCell.test.tsx`
Expected: PASS (these tests check letter text, `data-state`, and empty-state text — none of which this task changes).

- [ ] **Step 2: Replace STATE_CLASSES with the beveled treatment**

Modify `client/src/components/LetterCell.tsx` — replace the `STATE_CLASSES` object:

```tsx
const STATE_CLASSES: Record<LetterCellState, string> = {
  locked: "bg-chain-locked text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
  solved: "bg-chain-green text-white shadow-[0_3px_0_#2fa350] animate-tile-pop",
  hinted: "bg-chain-yellow text-chain-locked shadow-[0_3px_0_#e0b800]",
  typing:
    "bg-white text-chain-purple border-2 border-dashed border-chain-purple shadow-[0_0_0_3px_rgba(108,92,231,0.25)]",
  empty: "bg-white/40 border-2 border-dashed border-white/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
};
```

The rest of the file (props, the `<div>` markup, `data-testid`/`data-state`) is unchanged.

- [ ] **Step 3: Run the test to verify it still passes**

Run: `npm run test --workspace=client -- LetterCell.test.tsx`
Expected: PASS — all 3 `LetterCell` tests still green (only visual classes changed).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/LetterCell.tsx
git commit -m "Give every LetterCell state a tactile bevel treatment"
```

---

## Task 4: Redesign `ChainLink` as a visible badge

**Files:**
- Modify: `client/src/components/ChainLink.tsx`

**Interfaces:**
- Consumes: `LinkSimple` from `@phosphor-icons/react` (already a dependency)
- Produces: no interface change — same `ChainLinkProps`/`ChainLinkState`/`data-testid`/`data-state` as before, consumed by `ChainBoard` (unchanged) and the existing test.

- [ ] **Step 1: Confirm the existing test still describes the contract**

Run: `npm run test --workspace=client -- ChainLink.test.tsx`
Expected: PASS (these tests check `data-state` and that the component renders for all three states — no class assertions).

- [ ] **Step 2: Replace the component body**

Modify `client/src/components/ChainLink.tsx` — replace the whole file:

```tsx
import { LinkSimple } from "@phosphor-icons/react";

export type ChainLinkState = "inert" | "active" | "solved";

const STATE_CLASSES: Record<ChainLinkState, string> = {
  inert: "bg-white/10 text-white/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]",
  active: "bg-chain-yellow/90 text-chain-locked shadow-[0_2px_0_#e0b800]",
  solved: "bg-chain-green text-white shadow-[0_2px_0_#2fa350]",
};

export interface ChainLinkProps {
  state: ChainLinkState;
}

export function ChainLink({ state }: ChainLinkProps) {
  return (
    <div
      data-testid="chain-link"
      data-state={state}
      className={`ml-2.5 my-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${STATE_CLASSES[state]}`}
    >
      <LinkSimple size={14} weight="bold" className="rotate-90" />
    </div>
  );
}
```

This turns the previous bare 16px icon into a 24px circular badge with its own bevel, so the "chain" between rows is actually visible instead of a barely-there sliver.

- [ ] **Step 3: Run the test to verify it still passes**

Run: `npm run test --workspace=client -- ChainLink.test.tsx`
Expected: PASS — both `ChainLink` tests still green.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ChainLink.tsx
git commit -m "Turn ChainLink into a visible circular badge"
```

---

## Task 5: Migrate `ChainRow`'s hint button to `IconButton`

**Files:**
- Modify: `client/src/components/ChainRow.tsx`

**Interfaces:**
- Consumes: `IconButton` (Task 2)
- Produces: no interface change — same `ChainRowProps` as before, consumed by `ChainBoard` (unchanged) and the existing test.

- [ ] **Step 1: Confirm the existing test still describes the contract**

Run: `npm run test --workspace=client -- ChainRow.test.tsx`
Expected: PASS (these tests use `getByRole("button")`, the `title` attribute, and a click handler — `IconButton` renders a real `<button>` with both, so this holds).

- [ ] **Step 2: Replace the hint button with IconButton**

Modify `client/src/components/ChainRow.tsx` — add the import and replace the hint button:

```tsx
import { IconButton } from "./IconButton.js";
import { LetterCell, type LetterCellState } from "./LetterCell.js";
```

```tsx
      {showHintButton && (
        <IconButton
          title="Reveal the next letter of this word · costs 5s added to your time"
          onClick={onHintClick}
          className="ml-1 sm:ml-2 cursor-help shrink-0"
        >
          💡
        </IconButton>
      )}
```

(This replaces the previous inline `<button className="ml-1 sm:ml-2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/25 border-2 border-white text-base sm:text-lg flex items-center justify-center cursor-help shrink-0">💡</button>` — `IconButton` already supplies the sizing/bevel classes, so only the layout-specific `ml-*`/`cursor-help`/`shrink-0` classes are passed through via `className`.)

- [ ] **Step 3: Run the test to verify it still passes**

Run: `npm run test --workspace=client -- ChainRow.test.tsx`
Expected: PASS — all 3 `ChainRow` tests still green.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ChainRow.tsx
git commit -m "Migrate ChainRow's hint button to the shared IconButton"
```

---

## Task 6: Redesign the landing screen

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `Button` (Task 1), the existing `client/public/pwa-icon.svg` chain-link glyph (already in the repo, served at `/pwa-icon.svg`)
- Produces: no interface change — the `landing` screen branch's behavior (`setScreen` calls) is identical, only its markup changes.

- [ ] **Step 1: Add the Button import**

Modify `client/src/App.tsx` — add near the other component imports at the top of the file:

```tsx
import { Button } from "./components/Button.js";
```

- [ ] **Step 2: Replace the landing screen markup**

Modify `client/src/App.tsx` — replace the entire `if (screen.name === "landing") { ... }` block:

```tsx
  if (screen.name === "landing") {
    const chainPattern =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30'%3E%3Cg fill='none' stroke='white' stroke-opacity='0.08' stroke-width='3'%3E%3Cellipse cx='15' cy='15' rx='10' ry='6'/%3E%3Cellipse cx='35' cy='15' rx='10' ry='6'/%3E%3C/g%3E%3C/svg%3E";

    return (
      <div className="relative min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url("${chainPattern}")`, backgroundRepeat: "repeat" }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <img
            src="/pwa-icon.svg"
            alt=""
            aria-hidden="true"
            className="w-16 h-16 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.25)]"
          />
          <h1 className="font-display text-4xl text-white font-extrabold">Word Chain</h1>
          <p className="text-white/80 font-body">Chain each word to the next — every pair makes a real phrase.</p>
        </div>
        <div className="relative z-10 flex gap-4">
          <Button onClick={() => setScreen({ name: "hostSetup" })}>Host a game</Button>
          <Button variant="secondary" onClick={() => setScreen({ name: "join" })}>
            Join a game
          </Button>
        </div>
        <Button variant="ghost" className="relative z-10" onClick={() => setScreen({ name: "soloDifficulty" })}>
          Practice Solo
        </Button>
      </div>
    );
  }
```

The decorative pattern layer sits behind the content (`absolute inset-0` vs. `relative z-10` on the content wrappers) and is `pointer-events-none`/`aria-hidden` so it never intercepts clicks or gets announced to screen readers. The gradient stays on the outer `bg-gradient-to-br` class (unaffected by the pattern layer's own `background-image`, since that's a separate element).

- [ ] **Step 3: Verify the client still builds and its existing tests pass**

Run: `npm run test --workspace=client`
Expected: PASS — three tests in `client/tests/App.test.tsx` call `screen.findByText(/host a game/i)` after simulating a return-to-landing event (reconnect-to-missing-room, host-disconnect, host-ends-session). `Button`'s children render as plain text inside a real `<button>` with no added icons/wrapping text, so "Host a game" is still an exact text match — these assertions are unaffected by the variant/shadow styling change.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "Redesign landing screen with Button component and chain-link backdrop"
```

---

## Task 7: Migrate CTA buttons — JoinPage, HostSetupPage, PlayerLobbyPage, SoloDifficultyPage

**Files:**
- Modify: `client/src/pages/JoinPage.tsx`
- Modify: `client/src/pages/HostSetupPage.tsx`
- Modify: `client/src/pages/PlayerLobbyPage.tsx`
- Modify: `client/src/pages/SoloDifficultyPage.tsx`

**Interfaces:**
- Consumes: `Button` (Task 1)
- Produces: no interface change to any of these page components' props — only their internal button markup changes.

- [ ] **Step 1: Migrate JoinPage's submit button**

Modify `client/src/pages/JoinPage.tsx` — add `import { Button } from "../components/Button.js";` near the top, then replace the button at (around) line 88-95:

```tsx
<button
  type="button"
  disabled={!canJoin}
  onClick={handleJoin}
  className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full py-3 font-display font-extrabold text-chain-locked"
>
  Join
</button>
```

with:

```tsx
<Button disabled={!canJoin} onClick={handleJoin} className="w-full">
  Join
</Button>
```

- [ ] **Step 2: Migrate HostSetupPage's "Create Room" button**

Modify `client/src/pages/HostSetupPage.tsx` — add the `Button` import, then replace the button at (around) line 142-149 (`disabled={selectedIds.size === 0}`, `onClick={handleCreateRoom}`, className as shown in the file) with:

```tsx
<Button disabled={selectedIds.size === 0} onClick={handleCreateRoom}>
  Create Room
</Button>
```

- [ ] **Step 3: Migrate PlayerLobbyPage's team-select buttons**

Modify `client/src/pages/PlayerLobbyPage.tsx` — add the `Button` import, then replace the per-team button (currently `className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full py-2 font-display font-extrabold text-chain-locked"`, inside the `teams.map(...)`) with:

```tsx
<Button key={team.id} onClick={() => selectTeam(team.id)} className="w-full">
  {team.name}
</Button>
```

(Note the `key` moves from the outer `<button>` to `<Button>` — same list-rendering requirement, just on the new element.)

- [ ] **Step 4: Migrate SoloDifficultyPage's "Back" link**

Modify `client/src/pages/SoloDifficultyPage.tsx` — add the `Button` import, then replace:

```tsx
<button type="button" onClick={onBack} className="text-white/80 text-sm font-semibold underline">
  Back
</button>
```

with:

```tsx
<Button variant="ghost" onClick={onBack}>
  Back
</Button>
```

- [ ] **Step 5: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — all tests, including any for these four page components, remain green (they query by button text/role, not exact classes).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/JoinPage.tsx client/src/pages/HostSetupPage.tsx client/src/pages/PlayerLobbyPage.tsx client/src/pages/SoloDifficultyPage.tsx
git commit -m "Migrate JoinPage/HostSetupPage/PlayerLobbyPage/SoloDifficultyPage CTAs to Button"
```

---

## Task 8: Migrate CTA buttons — HostLobbyPage, HostRoundPage, CustomPuzzleCreatorPage

**Files:**
- Modify: `client/src/pages/HostLobbyPage.tsx`
- Modify: `client/src/pages/HostRoundPage.tsx`
- Modify: `client/src/pages/CustomPuzzleCreatorPage.tsx`

**Interfaces:**
- Consumes: `Button` (Task 1)
- Produces: no interface change to any of these page components' props.

- [ ] **Step 1: Migrate HostLobbyPage's "Start Game" button**

Modify `client/src/pages/HostLobbyPage.tsx` — add the `Button` import, then replace the button at (around) line 91-98 (`onClick={handleStart}`, `disabled={starting}`, className as shown in the file) with:

```tsx
<Button onClick={handleStart} disabled={starting}>
  Start Game
</Button>
```

Leave the "Kick" text link (`className="text-red-600 text-sm font-semibold"`) untouched — it's a destructive inline text action, not part of this CTA-button pass.

- [ ] **Step 2: Migrate HostRoundPage's "End Round" button**

Modify `client/src/pages/HostRoundPage.tsx` — add the `Button` import, then replace the button at (around) line 96-102 (`onClick={handleEndRound}`, className `"bg-white/20 border-2 border-white rounded-full px-4 py-1 text-sm"`) with:

```tsx
<Button variant="outline" size="sm" onClick={handleEndRound}>
  End Round
</Button>
```

- [ ] **Step 3: Migrate CustomPuzzleCreatorPage's "Save Puzzle" button**

Modify `client/src/pages/CustomPuzzleCreatorPage.tsx` — add the `Button` import, then replace the button at (around) line 62-68 (`onClick={handleSave}`, className `"bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-6 py-2 font-display font-extrabold text-chain-locked"`) with:

```tsx
<Button onClick={handleSave} size="sm">
  Save Puzzle
</Button>
```

Leave the "Cancel" text link (`className="text-chain-locked/60 text-sm font-semibold"`) untouched — it sits on a light card background, not the purple gradient `ghost` variant is styled for, so forcing it into `Button` would need a variant this pass doesn't need to add for one instance.

- [ ] **Step 4: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/HostLobbyPage.tsx client/src/pages/HostRoundPage.tsx client/src/pages/CustomPuzzleCreatorPage.tsx
git commit -m "Migrate HostLobbyPage/HostRoundPage/CustomPuzzleCreatorPage CTAs to Button"
```

---

## Task 9: Podium treatment for ResultsPage

**Files:**
- Modify: `client/src/pages/ResultsPage.tsx`

**Interfaces:**
- Consumes: `Button` (Task 1)
- Produces: no interface change — `ResultsPageProps` is unchanged; only the internal `LeaderboardRow` rendering and the advance button change.

- [ ] **Step 1: Add the Button import**

Modify `client/src/pages/ResultsPage.tsx` — add near the top:

```tsx
import { Button } from "../components/Button.js";
```

- [ ] **Step 2: Give the top 3 rows a medal treatment**

Modify `client/src/pages/ResultsPage.tsx` — replace the `LeaderboardRow` function:

```tsx
const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function LeaderboardRow({ rank, displayName, total }: { rank: number; displayName: string; total: number }) {
  const animatedTotal = useCountUp(total);
  const isPodium = rank <= 3;
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
        isPodium ? "bg-chain-yellow/15 shadow-[0_2px_0_rgba(224,184,0,0.25)]" : ""
      }`}
    >
      <span className="font-display font-bold text-chain-locked flex items-center gap-2">
        <span className={isPodium ? "text-xl" : "w-5 text-center text-chain-locked/60"}>
          {MEDAL_EMOJI[rank] ?? `${rank}.`}
        </span>
        {displayName}
      </span>
      <span className="font-mono font-bold text-chain-purple tabular-nums">{animatedTotal} pts</span>
    </div>
  );
}
```

This keeps every existing prop/behavior of `LeaderboardRow` (same props, same `useCountUp` call) — only the rendered markup for ranks 1-3 changes.

- [ ] **Step 3: Migrate the advance button**

Modify `client/src/pages/ResultsPage.tsx` — replace the button at (around) line 66-78 (`disabled={advancing}`, the `onClick` handler, className as shown in the file) with:

```tsx
{role === "host" && (
  <Button
    disabled={advancing}
    onClick={() => {
      if (advancing) return;
      setAdvancing(true);
      onAdvance?.();
    }}
  >
    {isLastRound ? "End Session" : "Next Round"}
  </Button>
)}
```

- [ ] **Step 4: Update the one test that asserts on exact rank text**

`client/tests/ResultsPage.test.tsx` has a test that asserts the old `"{rank}. {displayName}"` text format directly:

```ts
it("shows entrants ranked by total points, highest first", () => {
  render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
  const names = screen.getAllByText(/Alex|Sam/).map((el) => el.textContent);
  expect(names).toEqual(["1. Alex", "2. Sam"]);
});
```

Both `RESULTS` entrants in this test are ranked 1 and 2 (`TOTALS = { p1: 1000, p2: 500 }`), so both now render with a medal emoji instead of `"{rank}."`. Update the final assertion to:

```ts
    expect(names).toEqual(["🥇Alex", "🥈Sam"]);
```

No other line in this test changes. Run `npm run test --workspace=client -- ResultsPage.test.tsx` first to see it fail with the old string, confirming this is the only assertion this task breaks, then apply the fix above.

- [ ] **Step 5: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — every `ResultsPage` test green, including the one just updated.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ResultsPage.tsx client/tests/ResultsPage.test.tsx
git commit -m "Add podium medal treatment to ResultsPage leaderboard"
```

---

## Task 10: Polish SoloResultsPage

**Files:**
- Modify: `client/src/pages/SoloResultsPage.tsx`

**Interfaces:**
- Consumes: `Button` (Task 1)
- Produces: no interface change — `SoloResultsPageProps` unchanged.

- [ ] **Step 1: Add the Button import and shadow the stat card**

Modify `client/src/pages/SoloResultsPage.tsx` — add `import { Button } from "../components/Button.js";` near the top, then add `shadow-xl` to the stat card's className (currently `"bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3"`, becomes `"bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 shadow-xl"`) to match the elevation already used on `JoinPage`'s white card.

- [ ] **Step 2: Migrate both buttons**

Modify `client/src/pages/SoloResultsPage.tsx` — replace the two buttons at (around) lines 45-58:

```tsx
<div className="flex gap-3">
  <Button onClick={onPlayAgain}>Play Again</Button>
  <Button variant="secondary" onClick={onBackToMenu}>
    Back to Menu
  </Button>
</div>
```

- [ ] **Step 3: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/SoloResultsPage.tsx
git commit -m "Migrate SoloResultsPage buttons to Button and elevate the stat card"
```

---

## Task 11: Elevate HostRoundPage's entrant panels

**Files:**
- Modify: `client/src/pages/HostRoundPage.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: no interface change — `HostRoundPageProps` unchanged.

- [ ] **Step 1: Elevate the entrant card**

Modify `client/src/pages/HostRoundPage.tsx` — change the entrant card's className (currently `"bg-white/90 rounded-xl p-3"`, around line 110) to:

```tsx
<div key={entrantId} className="bg-white rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
```

- [ ] **Step 2: Bevel the solved progress boxes**

Modify `client/src/pages/HostRoundPage.tsx` — the progress-box className (around line 120-127) currently reads:

```tsx
className={`w-6 h-6 rounded-md ${
  solved ? "bg-chain-green" : "bg-white/60 border-2 border-dashed border-chain-locked/30"
}`}
```

Change it to:

```tsx
className={`w-6 h-6 rounded-md ${
  solved
    ? "bg-chain-green shadow-[0_2px_0_#2fa350]"
    : "bg-white/60 border-2 border-dashed border-chain-locked/30"
}`}
```

- [ ] **Step 3: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — `client/tests/HostRoundPage.test.tsx` asserts only on `data-testid="host-progress-box"` and its `data-state` attribute (`"pending"`/`"solved"`), both unchanged by this task's className-only edits.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/HostRoundPage.tsx
git commit -m "Elevate HostRoundPage entrant panels and bevel solved progress boxes"
```

---

## Task 12: Badge-style elapsed-time display

**Files:**
- Modify: `client/src/pages/PlayerRoundPage.tsx`
- Modify: `client/src/pages/SoloRoundPage.tsx`
- Modify: `client/src/pages/HostRoundPage.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: no interface change to any of these page components.

Both `PlayerRoundPage.test.tsx` and `SoloRoundPage.test.tsx` have a test that calls `screen.getByText("5s")` and expects it to resolve to the element whose *entire* text content is exactly `"5s"`. To add the clock glyph without breaking that exact match, nest the existing timer content (unchanged) inside a new inner span, and put the glyph as a sibling in a new outer badge wrapper — the inner span keeps exactly the classes/children it has today, so its `textContent` stays exactly `"5s"` in the no-penalty-flash case these tests use.

- [ ] **Step 1: Badge the timer in PlayerRoundPage**

Modify `client/src/pages/PlayerRoundPage.tsx` — the timer markup at (around) lines 123-133 currently reads:

```tsx
<span className="relative font-mono tabular-nums">
  {elapsedSeconds + boardView.penaltySeconds}s
  {penaltyFlashes.map((flash) => (
    <span
      key={flash.id}
      className="absolute left-1/2 -top-1 -translate-x-1/2 text-red-300 text-xs font-bold animate-penalty-float pointer-events-none"
    >
      +{flash.amount}s
    </span>
  ))}
</span>
```

Change it to:

```tsx
<span className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
  <span aria-hidden="true">⏱️</span>
  <span className="relative font-mono tabular-nums">
    {elapsedSeconds + boardView.penaltySeconds}s
    {penaltyFlashes.map((flash) => (
      <span
        key={flash.id}
        className="absolute left-1/2 -top-1 -translate-x-1/2 text-red-300 text-xs font-bold animate-penalty-float pointer-events-none"
      >
        +{flash.amount}s
      </span>
    ))}
  </span>
</span>
```

The inner `relative font-mono tabular-nums` span is byte-for-byte the same as the original span's classes and children — only its container changed, so `getByText("5s")` still resolves to it unchanged.

- [ ] **Step 2: Apply the identical restructuring to SoloRoundPage**

Modify `client/src/pages/SoloRoundPage.tsx` — the timer markup at (around) lines 84-94 is identical in structure to `PlayerRoundPage`'s (same classes, same `penaltyFlashes.map(...)` block). Apply the exact same before/after change as Step 1.

- [ ] **Step 3: Apply the same badge to HostRoundPage**

Modify `client/src/pages/HostRoundPage.tsx` — the host's timer is simpler (no penalty flashes, around line 95): `<span className="font-mono tabular-nums">{elapsedSeconds}s</span>`. No test in `HostRoundPage.test.tsx` queries this text, so a direct wrap is safe here. Change it to:

```tsx
<span className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
  <span aria-hidden="true">⏱️</span>
  <span className="font-mono tabular-nums">{elapsedSeconds}s</span>
</span>
```

- [ ] **Step 4: Run the client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — `PlayerRoundPage.test.tsx`'s and `SoloRoundPage.test.tsx`'s `getByText("5s")` assertions still resolve, since the inner span carrying that exact text is unchanged.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/PlayerRoundPage.tsx client/src/pages/SoloRoundPage.tsx client/src/pages/HostRoundPage.tsx
git commit -m "Give the elapsed-time display a badge treatment on every round page"
```

---

## Task 13: Full verification — build, tests, and visual comparison

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-12
- Produces: confidence the redesign is complete, builds, and looks intentional in a real browser — the final gate before this plan is done.

- [ ] **Step 1: Run the full client test suite**

Run: `npm run test --workspace=client`
Expected: PASS — every test file green, no regressions from the whole pass.

- [ ] **Step 2: Run the full repo test suite**

Run: `npm test` (from repo root)
Expected: PASS — `shared`, `server`, and `client` all green (this pass touches only `client`, so `shared`/`server` results should be identical to before this plan started).

- [ ] **Step 3: Build the client**

Run: `npm run build --workspace=client`
Expected: build completes with no TypeScript or Vite errors.

- [ ] **Step 4: Visual check — landing screen**

Start the dev servers (`npm run dev:server` and `npm run dev:client`, both backgrounded), open the client URL with the Chrome DevTools MCP tools, and take a screenshot of the landing screen. Confirm: the decorative chain-link pattern is visible but subtle (not overpowering the text), the hero glyph renders above the title, and both primary/secondary buttons show the beveled/shadowed look (not flat fills).

- [ ] **Step 5: Visual check — live ChainBoard**

Click "Practice Solo" → pick a difficulty → screenshot the resulting board. Confirm: letter tiles show a visible bevel per state (recessed `locked`, glossy `solved` with the pop animation on the row that just solved, glowing `typing`), the chain-link connectors between rows are now visible circular badges (not a barely-there sliver), and the elapsed-time display is a badge with a clock glyph rather than bare text.

- [ ] **Step 6: Visual check — results screen**

Solve the practice puzzle (or use "Give up" if present) to reach `SoloResultsPage`, screenshot it, and confirm the buttons and stat card show the new treatment. Then, separately, start a real 2-player round (host + one joined player, as in earlier manual smoke tests for this repo) through to `ResultsPage` and screenshot it, confirming the top-3 rows show medal emoji with a highlighted band.

- [ ] **Step 7: Stop the dev servers and close browser tabs opened for this check**

No commit for this task — it's verification only, nothing changed.
