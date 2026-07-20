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
