import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChainLink } from "../src/components/ChainLink.js";

describe("ChainLink", () => {
  it("exposes its state via a data attribute for styling/testing", () => {
    render(<ChainLink state="solved" />);
    expect(screen.getByTestId("chain-link")).toHaveAttribute("data-state", "solved");
  });

  it("renders for each of the three states without throwing", () => {
    (["inert", "active", "solved"] as const).forEach((state) => {
      const { unmount } = render(<ChainLink state={state} />);
      expect(screen.getByTestId("chain-link")).toBeInTheDocument();
      unmount();
    });
  });
});
