import { useEffect, useState } from "react";
import type { GameMode, PublicBoardView, RoundResult, RoundStartedPayload, TeamInfo } from "@wordchain/shared";
import { ChainRow, type ChainCellData } from "../components/ChainRow.js";
import { getSocket } from "../socket.js";

export interface HostRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  teams: TeamInfo[];
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}

export function HostRoundPage({ roundData, mode, teams, onResults }: HostRoundPageProps) {
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [boards, setBoards] = useState<Record<string, PublicBoardView>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    function rememberNickname(player: { socketId: string; nickname: string }) {
      setNicknames((prev) => ({ ...prev, [player.socketId]: player.nickname }));
    }
    function handleBoardUpdated(payload: { entrantId: string; view: PublicBoardView }) {
      setBoards((prev) => ({ ...prev, [payload.entrantId]: payload.view }));
    }
    function handleResults(payload: { results: RoundResult[]; totals: Record<string, number> }) {
      onResults(payload);
    }

    socket.on("room:playerJoined", rememberNickname);
    socket.on("room:playerUpdated", rememberNickname);
    socket.on("board:updated", handleBoardUpdated);
    socket.on("round:results", handleResults);
    return () => {
      socket.off("room:playerJoined");
      socket.off("room:playerUpdated");
      socket.off("board:updated");
      socket.off("round:results");
    };
  }, [onResults]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - roundData.startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [roundData.startedAt]);

  function displayName(entrantId: string): string {
    if (mode === "team") {
      return teams.find((t) => t.id === entrantId)?.name ?? entrantId;
    }
    return nicknames[entrantId] ?? entrantId;
  }

  function handleEndRound() {
    getSocket().emit("host:endRound", {}, () => {});
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-white font-display font-bold">
        <span>{roundData.category}</span>
        <span>{elapsedSeconds}s</span>
        <button
          type="button"
          onClick={handleEndRound}
          className="bg-white/20 border-2 border-white rounded-full px-4 py-1 text-sm"
        >
          End Round
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(boards).map(([entrantId, view]) => (
          <div key={entrantId} className="bg-white/90 rounded-xl p-3">
            <p className="font-display font-bold text-chain-locked text-sm mb-2">{displayName(entrantId)}</p>
            <div className="flex flex-col gap-1">
              {roundData.rows.map((row) => {
                const revealed = view.revealedText[row.index];
                const cells: ChainCellData[] = Array.from({ length: row.length }, (_, i) => ({
                  letter: revealed?.[i],
                  state: row.isClue
                    ? "locked"
                    : revealed && i < revealed.length
                      ? "solved"
                      : "empty",
                }));
                return <ChainRow key={row.index} cells={cells} showHintButton={false} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
