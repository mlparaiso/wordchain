import { useEffect, useState } from "react";
import type {
  GameMode,
  PlayerInfo,
  PublicBoardView,
  RoundActivityEvent,
  RoundResult,
  RoundStartedPayload,
  TeamInfo,
} from "@wordchain/shared";
import { ActivityFeed, type ActivityEntry } from "../components/ActivityFeed.js";
import { Button } from "../components/Button.js";
import { getSocket } from "../socket.js";

const MAX_ACTIVITY_ENTRIES = 30;
let nextActivityId = 0;

export interface HostRoundPageProps {
  roundData: RoundStartedPayload;
  mode: GameMode;
  teams: TeamInfo[];
  players: PlayerInfo[];
  onResults: (payload: { results: RoundResult[]; totals: Record<string, number> }) => void;
}

export function HostRoundPage({ roundData, mode, teams, players, onResults }: HostRoundPageProps) {
  const [nicknames, setNicknames] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.socketId, p.nickname]))
  );
  const [boards, setBoards] = useState<Record<string, PublicBoardView>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

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
    function handleActivity(payload: RoundActivityEvent) {
      setActivity((current) => [{ ...payload, id: nextActivityId++ }, ...current].slice(0, MAX_ACTIVITY_ENTRIES));
    }

    socket.on("room:playerJoined", rememberNickname);
    socket.on("room:playerUpdated", rememberNickname);
    socket.on("board:updated", handleBoardUpdated);
    socket.on("round:results", handleResults);
    socket.on("round:activity", handleActivity);
    return () => {
      socket.off("room:playerJoined", rememberNickname);
      socket.off("room:playerUpdated", rememberNickname);
      socket.off("board:updated", handleBoardUpdated);
      socket.off("round:results", handleResults);
      socket.off("round:activity", handleActivity);
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

  function defaultBoardView(): PublicBoardView {
    return { topSolved: 0, bottomSolved: roundData.rows.length - 1, revealedText: {}, penaltySeconds: 0 };
  }

  const knownEntrantIds = mode === "team" ? teams.map((t) => t.id) : Object.keys(nicknames);
  const entrantIds = [...new Set([...knownEntrantIds, ...Object.keys(boards)])];
  const topRow = roundData.rows[0];
  const bottomRow = roundData.rows[roundData.rows.length - 1];
  const blankRows = roundData.rows.filter((row) => !row.isClue);

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-3 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-white font-display font-bold">
        <span className="uppercase tracking-widest text-sm opacity-90">{roundData.category}</span>
        <span className="font-mono tabular-nums">{elapsedSeconds}s</span>
        <Button variant="outline" size="sm" onClick={handleEndRound}>
          End Round
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1">
          {entrantIds.map((entrantId) => {
            const view = boards[entrantId] ?? defaultBoardView();
            return (
              <div key={entrantId} className="bg-white/90 rounded-xl p-3">
                <p className="font-display font-bold text-chain-locked text-sm mb-2">{displayName(entrantId)}</p>
                <div className="flex flex-col gap-2">
                  <p className="font-display font-bold text-chain-locked text-sm uppercase tracking-wide">
                    {topRow.text}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {blankRows.map((row) => {
                      const solved = row.index <= view.topSolved || row.index >= view.bottomSolved;
                      return (
                        <div
                          key={row.index}
                          data-testid="host-progress-box"
                          data-state={solved ? "solved" : "pending"}
                          className={`w-6 h-6 rounded-md ${
                            solved ? "bg-chain-green" : "bg-white/60 border-2 border-dashed border-chain-locked/30"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="font-display font-bold text-chain-locked text-sm uppercase tracking-wide">
                    {bottomRow.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <ActivityFeed entries={activity} />
      </div>
    </div>
  );
}
