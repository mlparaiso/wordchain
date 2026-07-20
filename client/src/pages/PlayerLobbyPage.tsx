import { useEffect, useState } from "react";
import type { GameMode, TeamInfo, RoundStartedPayload } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface PlayerLobbyPageProps {
  mode: GameMode;
  teams: TeamInfo[];
  onTeamSelected: (teamId: string) => void;
  onRoundStarted: (payload: RoundStartedPayload) => void;
}

export function PlayerLobbyPage({ mode, teams, onTeamSelected, onRoundStarted }: PlayerLobbyPageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("round:started", onRoundStarted);
    return () => {
      socket.off("round:started");
    };
  }, [onRoundStarted]);

  function selectTeam(teamId: string) {
    getSocket().emit("player:selectTeam", { teamId }, () => {
      setSelectedTeamId(teamId);
      onTeamSelected(teamId);
    });
  }

  const showTeamChoice = mode === "team" && selectedTeamId === null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4 items-center text-center">
        {showTeamChoice ? (
          <>
            <h1 className="font-display text-xl font-extrabold text-chain-locked">Pick a team</h1>
            <div className="flex flex-col gap-2 w-full">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => selectTeam(team.id)}
                  className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full py-2 font-display font-extrabold text-chain-locked"
                >
                  {team.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-extrabold text-chain-locked">You're in! 🎉</h1>
            <p className="text-chain-locked/70">Waiting for the host to start the game...</p>
          </>
        )}
      </div>
    </div>
  );
}
