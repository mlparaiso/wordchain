import { useState } from "react";
import { getSessionToken, getSocket } from "../socket.js";
import { Button } from "../components/Button.js";

export interface JoinedData {
  code: string;
  nickname: string;
  mode: "individual" | "team";
  teams: { id: string; name: string }[];
  teamId: string | null;
  activeRound?: {
    puzzleId: string;
    category: string;
    timeCapSeconds: number;
    rows: unknown[];
    startedAt: number;
    isLastRound: boolean;
  };
  boardView?: {
    topSolved: number;
    bottomSolved: number;
    revealedText: Record<number, string>;
    penaltySeconds: number;
  };
}

export interface JoinPageProps {
  onJoined: (data: JoinedData) => void;
}

export function JoinPage({ onJoined }: JoinPageProps) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canJoin = code.trim().length > 0 && nickname.trim().length > 0;

  function handleJoin() {
    setError(null);
    const trimmedCode = code.trim().toUpperCase();
    getSocket().emit(
      "player:joinRoom",
      { code: trimmedCode, nickname: nickname.trim(), sessionToken: getSessionToken() },
      (response: JoinedData & { success: boolean; error?: string }) => {
        if (response.success) {
          onJoined({
            code: trimmedCode,
            nickname: nickname.trim(),
            mode: response.mode,
            teams: response.teams,
            teamId: response.teamId ?? null,
            activeRound: response.activeRound,
            boardView: response.boardView,
          });
        } else {
          setError(response.error ?? "Could not join the room");
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4 shadow-xl">
        <h1 className="font-display text-2xl font-extrabold text-chain-locked text-center">Join a game</h1>

        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Room code
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2 uppercase font-mono tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BLUE-42"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Nickname
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
          />
        </label>

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

        <Button disabled={!canJoin} onClick={handleJoin} className="w-full">
          Join
        </Button>
      </div>
    </div>
  );
}
