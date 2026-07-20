import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed, type ActivityEntry } from "../src/components/ActivityFeed.js";

describe("ActivityFeed", () => {
  it("shows a placeholder when there is no activity yet", () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText(/no actions yet/i)).toBeInTheDocument();
  });

  it("describes a hint entry with the player's name", () => {
    const entries: ActivityEntry[] = [{ id: 1, type: "hint", entrantId: "p1", nickname: "Alex", rowIndex: 1 }];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText(/used a hint/i)).toBeInTheDocument();
  });

  it("describes a correct guess entry with the solved word", () => {
    const entries: ActivityEntry[] = [
      { id: 1, type: "correct", entrantId: "p1", nickname: "Sam", rowIndex: 1, word: "DOG" },
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText(/solved DOG/)).toBeInTheDocument();
  });

  it("shows the individual player's name in team mode, not the team", () => {
    const entries: ActivityEntry[] = [
      { id: 1, type: "correct", entrantId: "t1", nickname: "Jamie", rowIndex: 1, word: "DOG" },
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText("Jamie")).toBeInTheDocument();
    expect(screen.queryByText("t1")).not.toBeInTheDocument();
  });
});
