import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundStartedPayload } from "@wordchain/shared";
import { HostRoundPage } from "../src/pages/HostRoundPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true }));
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const ROUND_DATA: RoundStartedPayload = {
  puzzleId: "p1",
  category: "Classics",
  timeCapSeconds: 60,
  startedAt: 0,
  isLastRound: false,
  rows: [
    { index: 0, length: 3, isClue: true, text: "HOT" },
    { index: 1, length: 3, isClue: false },
    { index: 2, length: 4, isClue: true, text: "KICK" },
  ],
};

describe("HostRoundPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("adds a labeled mini-board once a player has joined and their board updates", () => {
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
      fakeSocket.trigger("board:updated", {
        entrantId: "p1",
        view: { topSolved: 0, bottomSolved: 2, revealedText: { 0: "HOT", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("labels a team-mode board with the team name", () => {
    render(
      <HostRoundPage
        roundData={ROUND_DATA}
        mode="team"
        teams={[{ id: "t1", name: "Red Team" }]}
        onResults={vi.fn()}
      />
    );
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "t1",
        view: { topSolved: 0, bottomSolved: 2, revealedText: { 0: "HOT", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    expect(screen.getByText("Red Team")).toBeInTheDocument();
  });

  it("emits host:endRound when End Round is clicked", async () => {
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /end round/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("host:endRound", {}, expect.any(Function));
  });

  it("calls onResults when round:results fires", () => {
    const onResults = vi.fn();
    render(<HostRoundPage roundData={ROUND_DATA} mode="individual" teams={[]} onResults={onResults} />);
    const payload = { results: [], totals: {} };
    act(() => {
      fakeSocket.trigger("round:results", payload);
    });
    expect(onResults).toHaveBeenCalledWith(payload);
  });
});
