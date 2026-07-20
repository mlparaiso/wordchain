import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerLobbyPage } from "../src/pages/PlayerLobbyPage.js";

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

describe("PlayerLobbyPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("shows a waiting message directly in individual mode", () => {
    render(<PlayerLobbyPage mode="individual" teams={[]} onTeamSelected={vi.fn()} onRoundStarted={vi.fn()} />);
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("shows team choices in team mode, selects one on click, and reports it up", async () => {
    const onTeamSelected = vi.fn();
    render(
      <PlayerLobbyPage
        mode="team"
        teams={[{ id: "t1", name: "Red Team" }, { id: "t2", name: "Blue Team" }]}
        onTeamSelected={onTeamSelected}
        onRoundStarted={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Red Team" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("player:selectTeam", { teamId: "t1" }, expect.any(Function));
    expect(onTeamSelected).toHaveBeenCalledWith("t1");
    expect(await screen.findByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("calls onRoundStarted with the round payload when round:started fires", () => {
    const onRoundStarted = vi.fn();
    render(<PlayerLobbyPage mode="individual" teams={[]} onTeamSelected={vi.fn()} onRoundStarted={onRoundStarted} />);
    const payload = { puzzleId: "p1", rows: [], timeCapSeconds: 60, category: "Test", startedAt: 0, isLastRound: false };
    act(() => {
      fakeSocket.trigger("round:started", payload);
    });
    expect(onRoundStarted).toHaveBeenCalledWith(payload);
  });
});
