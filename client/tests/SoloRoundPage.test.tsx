import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Puzzle } from "@wordchain/shared";
import { SoloRoundPage } from "../src/pages/SoloRoundPage.js";

vi.mock("../src/sound.js", () => ({
  playTone: vi.fn(),
  isSoundEnabled: vi.fn(() => true),
  setSoundEnabled: vi.fn(),
}));

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Classics",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("SoloRoundPage", () => {
  it("shows the puzzle category", () => {
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={vi.fn()} onQuit={vi.fn()} />);
    expect(screen.getByText("Classics")).toBeInTheDocument();
  });

  it("calls onFinished with a time+penalty summary once the chain is solved", async () => {
    const onFinished = vi.fn();
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={onFinished} onQuit={vi.fn()} />);

    // DOG is the chain's only (and therefore middle) blank, so its first letter is
    // already revealed for free as the starting hint — only "OG" needs typing.
    await userEvent.type(screen.getByLabelText("Guess for row 1"), "OG{enter}");

    expect(onFinished).toHaveBeenCalledTimes(1);
    const summary = onFinished.mock.calls[0][0];
    expect(summary.puzzle).toBe(PUZZLE);
    expect(summary.wrongGuesses).toBe(0);
    expect(summary.hintsUsed).toBe(0);
    expect(summary.rowsSolved).toBe(1);
    expect(summary.totalRows).toBe(1);
    expect(summary.rawTimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("counts a wrong guess before the eventual correct one", async () => {
    const onFinished = vi.fn();
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={onFinished} onQuit={vi.fn()} />);

    // DOG's first letter is already revealed for free (it's the chain's only blank),
    // so only the remaining letters need typing for each guess.
    const input = screen.getByLabelText("Guess for row 1");
    await userEvent.type(input, "AT{enter}"); // "DAT" - wrong
    await userEvent.type(input, "OG{enter}"); // "DOG" - correct

    expect(onFinished.mock.calls[0][0].wrongGuesses).toBe(1);
  });

  it("counts a hint used before the eventual correct guess", async () => {
    const onFinished = vi.fn();
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={onFinished} onQuit={vi.fn()} />);

    // The starting hint already reveals "D" for free; this explicit hint reveals the
    // second letter ("DO"), so only the final letter needs typing.
    await userEvent.click(screen.getByRole("button", { name: "💡" }));
    await userEvent.type(screen.getByLabelText("Guess for row 1"), "G{enter}");

    expect(onFinished.mock.calls[0][0].hintsUsed).toBe(1);
  });

  it("shows the hint penalty in the timer immediately, not only at the end", async () => {
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={vi.fn()} onQuit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "💡" }));
    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("calls onQuit when Give up is clicked", async () => {
    const onQuit = vi.fn();
    render(<SoloRoundPage puzzle={PUZZLE} onFinished={vi.fn()} onQuit={onQuit} />);
    await userEvent.click(screen.getByRole("button", { name: /give up/i }));
    expect(onQuit).toHaveBeenCalled();
  });
});
