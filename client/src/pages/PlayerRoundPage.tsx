import { useEffect, useState } from "react";
import type {
  GameMode,
  PublicBoardView,
  PublicChainRow,
  RoundActivityEvent,
  RoundResult,
  RoundStartedPayload,
} from "@wordchain/shared";
import { ChainBoard } from "../components/ChainBoard.js";
import { ActivityFeed, type ActivityEntry } from "../components/ActivityFeed.js";
import { getSocket } from "../socket.js";
import { isSoundEnabled, playTone, setSoundEnabled } from "../sound.js";
import { usePenaltyFlashes } from "../usePenaltyFlashes.js";

const MAX_ACTIVITY_ENTRIES = 30;
let nextActivityId = 0;

export interface PlayerRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  myTeamId: string | null;
  initialBoardView?: PublicBoardView;
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}

function computeInitialBoardView(rows: PublicChainRow[]): PublicBoardView {
  const revealedText: Record<number, string> = {};
  rows.forEach((row) => {
    if (row.isClue) revealedText[row.index] = row.text!;
  });
  return { topSolved: 0, bottomSolved: rows.length - 1, revealedText, penaltySeconds: 0 };
}

export function PlayerRoundPage({ roundData, mode, myTeamId, initialBoardView, onResults }: PlayerRoundPageProps) {
  const [boardView, setBoardView] = useState<PublicBoardView>(
    () => initialBoardView ?? computeInitialBoardView(roundData.rows)
  );
  const [finished, setFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [typingIndicator, setTypingIndicator] = useState<{ rowIndex: number; nickname: string } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const penaltyFlashes = usePenaltyFlashes(boardView.penaltySeconds);

  const myEntrantId = mode === "team" ? myTeamId : getSocket().id;

  useEffect(() => {
    const socket = getSocket();
    let typingTimeout: ReturnType<typeof setTimeout> | undefined;

    function handleBoardUpdated(payload: { entrantId: string; view: PublicBoardView }) {
      if (payload.entrantId !== myEntrantId) return;
      setBoardView(payload.view);
    }
    function handleChainComplete(payload: { entrantId: string }) {
      if (payload.entrantId !== myEntrantId) return;
      setFinished(true);
      playTone("complete");
    }
    function handleResults(payload: { results: RoundResult[]; totals: Record<string, number> }) {
      onResults(payload);
    }
    function handleTyping(payload: { entrantId: string; nickname: string; rowIndex: number }) {
      if (payload.entrantId !== myEntrantId) return;
      setTypingIndicator({ rowIndex: payload.rowIndex, nickname: payload.nickname });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTypingIndicator(null), 2000);
    }
    function handleActivity(payload: RoundActivityEvent) {
      setActivity((current) => [{ ...payload, id: nextActivityId++ }, ...current].slice(0, MAX_ACTIVITY_ENTRIES));
    }

    socket.on("board:updated", handleBoardUpdated);
    socket.on("player:chainComplete", handleChainComplete);
    socket.on("round:results", handleResults);
    socket.on("board:typing", handleTyping);
    socket.on("round:activity", handleActivity);
    return () => {
      socket.off("board:updated");
      socket.off("player:chainComplete");
      socket.off("round:results");
      socket.off("board:typing");
      socket.off("round:activity");
      clearTimeout(typingTimeout);
    };
  }, [myEntrantId, onResults]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - roundData.startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [roundData.startedAt]);

  function handleSubmitGuess(rowIndex: number, guess: string) {
    getSocket().emit("player:submitGuess", { rowIndex, guess }, (response: { correct?: boolean }) => {
      playTone(response.correct ? "correct" : "wrong");
    });
  }

  function handleHint(rowIndex: number) {
    getSocket().emit("player:useHint", { rowIndex }, () => {});
  }

  function handleTyping(rowIndex: number) {
    getSocket().emit("player:typing", { rowIndex });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-3 sm:p-6 flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-md text-white font-display font-bold">
        <span className="uppercase tracking-widest text-sm opacity-90">{roundData.category}</span>
        <span className="relative font-mono tabular-nums">
          {elapsedSeconds + boardView.penaltySeconds}s
          {penaltyFlashes.map((flash) => (
            <span
              key={flash.id}
              className="absolute left-1/2 -top-1 -translate-x-1/2 text-red-300 text-xs font-bold animate-penalty-float pointer-events-none"
            >
              +{flash.amount}s
            </span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !soundOn;
            setSoundEnabled(next);
            setSoundOn(next);
          }}
          className="text-xl"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
      </div>

      {finished && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-white font-display text-2xl font-extrabold uppercase tracking-wide">🔥 Solved!</p>
          <p className="text-white/80 font-body text-sm">Waiting for others...</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl items-start justify-center">
        <div className="w-full max-w-md flex justify-start">
          <ChainBoard
            rows={roundData.rows}
            boardView={boardView}
            onSubmitGuess={handleSubmitGuess}
            onHint={handleHint}
            onTyping={handleTyping}
            typingIndicator={typingIndicator}
          />
        </div>
        <ActivityFeed entries={activity} />
      </div>
    </div>
  );
}
