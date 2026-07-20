import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundStartedPayload } from "@wordchain/shared";
import { PlayerRoundPage } from "../src/pages/PlayerRoundPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true, correct: true }));
  return {
    id: "my-socket-id",
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));
vi.mock("../src/sound.js", () => ({
  playTone: vi.fn(),
  isSoundEnabled: vi.fn(() => true),
  setSoundEnabled: vi.fn(),
}));

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

describe("PlayerRoundPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
    localStorage.clear();
  });

  it("shows the puzzle category", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    expect(screen.getByText("Classics")).toBeInTheDocument();
  });

  it("applies a board:updated event addressed to my own socket id", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "my-socket-id",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.map((c) => c.textContent).join("")).toBe("DOG");
  });

  it("ignores a board:updated event addressed to someone else", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "someone-elses-socket",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.every((c) => c.textContent === "")).toBe(true);
  });

  it("uses the team id (not the socket id) to filter updates in team mode", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="team" myTeamId="t1" onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "t1",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });
    const cells = screen.getAllByTestId("letter-cell").slice(3, 6);
    expect(cells.map((c) => c.textContent).join("")).toBe("DOG");
  });

  it("shows a solved message when player:chainComplete fires for me", () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("player:chainComplete", { entrantId: "my-socket-id" });
    });
    expect(screen.getByText(/solved/i)).toBeInTheDocument();
  });

  it("calls onResults when round:results fires", () => {
    const onResults = vi.fn();
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={onResults} />);
    const payload = { results: [], totals: {} };
    act(() => {
      fakeSocket.trigger("round:results", payload);
    });
    expect(onResults).toHaveBeenCalledWith(payload);
  });

  it("submits a typed guess for the active row", async () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    const input = screen.getByLabelText("Guess for row 1");
    await userEvent.type(input, "DOG{enter}");
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "player:submitGuess",
      { rowIndex: 1, guess: "DOG" },
      expect.any(Function)
    );
  });

  it("shows a typing indicator addressed to me and emits player:typing while I type", async () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Guess for row 1"), "D");
    expect(fakeSocket.emit).toHaveBeenCalledWith("player:typing", { rowIndex: 1 });

    act(() => {
      fakeSocket.trigger("board:typing", { entrantId: "my-socket-id", nickname: "Jamie", rowIndex: 1 });
    });
    expect(screen.getByText("✏️ Jamie is typing…")).toBeInTheDocument();
  });

  it("toggles the sound setting and updates the button label", async () => {
    render(<PlayerRoundPage roundData={ROUND_DATA} mode="individual" myTeamId={null} onResults={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /🔊|🔇/ });
    expect(toggle).toHaveTextContent("🔊");
    await userEvent.click(toggle);
    expect(toggle).toHaveTextContent("🔇");
  });
});
