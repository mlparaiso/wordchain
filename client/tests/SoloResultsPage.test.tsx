import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Puzzle } from "@wordchain/shared";
import { SoloResultsPage } from "../src/pages/SoloResultsPage.js";
import type { SoloRunSummary } from "../src/pages/SoloRoundPage.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Classics",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

const SUMMARY: SoloRunSummary = {
  puzzle: PUZZLE,
  rawTimeSeconds: 23,
  wrongGuesses: 2,
  hintsUsed: 1,
  rowsSolved: 1,
  totalRows: 1,
};

describe("SoloResultsPage", () => {
  it("shows the final time and a penalty breakdown", () => {
    render(<SoloResultsPage summary={SUMMARY} onPlayAgain={vi.fn()} onBackToMenu={vi.fn()} />);
    expect(screen.getByText("23.0s")).toBeInTheDocument();
    // 2 wrong guesses * 3s + 1 hint * 5s = 11s penalty -> solve time 23 - 11 = 12.0s
    expect(screen.getByText("12.0s")).toBeInTheDocument();
    expect(screen.getByText("2 (+6s)")).toBeInTheDocument();
    expect(screen.getByText("1 (+5s)")).toBeInTheDocument();
  });

  it("calls onPlayAgain and onBackToMenu", async () => {
    const onPlayAgain = vi.fn();
    const onBackToMenu = vi.fn();
    render(<SoloResultsPage summary={SUMMARY} onPlayAgain={onPlayAgain} onBackToMenu={onBackToMenu} />);
    await userEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onPlayAgain).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(onBackToMenu).toHaveBeenCalled();
  });
});
