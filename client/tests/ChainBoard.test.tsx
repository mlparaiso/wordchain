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
    render(<ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders clue text as locked cells", () => {
    render(<ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={vi.fn()} />);
    const hotCells = screen.getAllByTestId("letter-cell").slice(0, 3);
    expect(hotCells.map((c) => c.textContent).join("")).toBe("HOT");
    expect(hotCells.every((c) => c.getAttribute("data-state") === "locked")).toBe(true);
  });

  it("submits the typed guess for the active row on Enter", async () => {
    const onSubmitGuess = vi.fn();
    render(<ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={onSubmitGuess} onHint={vi.fn()} />);
    const input = screen.getByLabelText("Guess for row 1");
    await userEvent.type(input, "DOG{enter}");
    expect(onSubmitGuess).toHaveBeenCalledWith(1, "DOG");
  });

  it("calls onHint with the row index when a hint button is clicked", async () => {
    const onHint = vi.fn();
    render(<ChainBoard rows={ROWS} boardView={INITIAL_VIEW} onSubmitGuess={vi.fn()} onHint={onHint} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
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
});
