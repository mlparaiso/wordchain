import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PUZZLE_LIBRARY } from "@wordchain/shared";
import { SoloDifficultyPage } from "../src/pages/SoloDifficultyPage.js";

describe("SoloDifficultyPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows all three difficulty options", () => {
    render(<SoloDifficultyPage onPuzzleChosen={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /easy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hard/i })).toBeInTheDocument();
  });

  it("picks a random puzzle from the chosen difficulty tier", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onPuzzleChosen = vi.fn();
    render(<SoloDifficultyPage onPuzzleChosen={onPuzzleChosen} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /hard/i }));

    const chosen = onPuzzleChosen.mock.calls[0][0];
    expect(chosen.difficulty).toBe("hard");
    const hardPuzzles = PUZZLE_LIBRARY.filter((p) => p.difficulty === "hard");
    expect(chosen).toEqual(hardPuzzles[0]);
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(<SoloDifficultyPage onPuzzleChosen={vi.fn()} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
