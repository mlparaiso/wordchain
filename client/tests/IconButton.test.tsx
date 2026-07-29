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
