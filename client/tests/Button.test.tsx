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

  it("does not call onClick when disabled with ghost variant", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="ghost" disabled onClick={onClick}>
        Go
      </Button>
    );
    expect(screen.getByTestId("button")).toHaveAttribute("disabled");
    await userEvent.click(screen.getByText("Go"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
