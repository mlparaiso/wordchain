import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoundResult } from "@wordchain/shared";
import { ResultsPage } from "../src/pages/ResultsPage.js";

const confettiMock = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confettiMock }));

type Handler = (payload: unknown) => void;
function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}
let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const RESULTS: RoundResult[] = [
  { entrantId: "p1", displayName: "Alex", finished: true, rowsSolved: 4, totalRows: 4, rawTimeSeconds: 20, points: 1000 },
  { entrantId: "p2", displayName: "Sam", finished: true, rowsSolved: 4, totalRows: 4, rawTimeSeconds: 40, points: 500 },
];
const TOTALS = { p1: 1000, p2: 500 };

describe("ResultsPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
    confettiMock.mockClear();
  });

  it("shows entrants ranked by total points, highest first", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    const names = screen.getAllByText(/Alex|Sam/).map((el) => el.textContent);
    expect(names).toEqual(["🥇Alex", "🥈Sam"]);
  });

  it("shows a Round Results heading and no confetti for a normal round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    expect(screen.getByText("Round Results")).toBeInTheDocument();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("shows a Final Results heading and fires confetti on the last round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={true} />);
    expect(screen.getByText(/Final Results/)).toBeInTheDocument();
    expect(confettiMock).toHaveBeenCalled();
  });

  it("shows a Next Round button for the host on a normal round, calling onAdvance", async () => {
    const onAdvance = vi.fn();
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="host" isLastRound={false} onAdvance={onAdvance} />);
    await userEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(onAdvance).toHaveBeenCalled();
  });

  it("shows an End Session button for the host on the last round", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="host" isLastRound={true} onAdvance={vi.fn()} />);
    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("shows no action button for players", () => {
    render(<ResultsPage results={RESULTS} totals={TOTALS} role="player" isLastRound={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onNextRoundStarted when round:started fires for a waiting player", () => {
    const onNextRoundStarted = vi.fn();
    render(
      <ResultsPage
        results={RESULTS}
        totals={TOTALS}
        role="player"
        isLastRound={false}
        onNextRoundStarted={onNextRoundStarted}
      />
    );
    const payload = { puzzleId: "p2", rows: [], timeCapSeconds: 60, category: "Test", startedAt: 0, isLastRound: false };
    act(() => {
      fakeSocket.trigger("round:started", payload);
    });
    expect(onNextRoundStarted).toHaveBeenCalledWith(payload);
  });
});
