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
