import { useState } from "react";
import { getSocket } from "../socket.js";

export interface JoinedData {
  nickname: string;
  mode: "individual" | "team";
  teams: { id: string; name: string }[];
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
    getSocket().emit(
      "player:joinRoom",
      { code: code.trim().toUpperCase(), nickname: nickname.trim() },
      (response: JoinedData & { success: boolean; error?: string }) => {
        if (response.success) {
          onJoined({
            nickname: nickname.trim(),
            mode: response.mode,
            teams: response.teams,
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
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4 shadow-xl">
        <h1 className="font-display text-2xl font-extrabold text-chain-locked text-center">Join a game</h1>

        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Room code
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2 uppercase"
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

        <button
          type="button"
          disabled={!canJoin}
          onClick={handleJoin}
          className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full py-3 font-display font-extrabold text-chain-locked"
        >
          Join
        </button>
      </div>
    </div>
  );
}
