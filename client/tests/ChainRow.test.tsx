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
