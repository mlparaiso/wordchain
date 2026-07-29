import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Puzzle, PlayerInfo } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface HostLobbyPageProps {
  roomCode: string;
  playlist: Puzzle[];
  onStarted: (puzzle: Puzzle, players: PlayerInfo[]) => void;
}

export function HostLobbyPage({ roomCode, playlist, onStarted }: HostLobbyPageProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    function upsertPlayer(player: PlayerInfo) {
      setPlayers((prev) => {
        const withoutExisting = prev.filter((p) => p.socketId !== player.socketId);
        return [...withoutExisting, player];
      });
    }
    function removePlayer(payload: { socketId: string }) {
      setPlayers((prev) => prev.filter((p) => p.socketId !== payload.socketId));
    }

    socket.on("room:playerJoined", upsertPlayer);
    socket.on("room:playerUpdated", upsertPlayer);
    socket.on("room:playerLeft", removePlayer);

    return () => {
      socket.off("room:playerJoined", upsertPlayer);
      socket.off("room:playerUpdated", upsertPlayer);
      socket.off("room:playerLeft", removePlayer);
    };
  }, []);

  function handleKick(socketId: string) {
    getSocket().emit("host:kickPlayer", { socketId }, () => {});
  }

  function handleStart() {
    if (starting) return;
    setStarting(true);
    getSocket().emit(
      "host:startRound",
      { puzzle: playlist[0], isLastRound: playlist.length === 1 },
      (response: { success: boolean }) => {
        if (response.success) {
          onStarted(playlist[0], players);
        } else {
          setStarting(false);
        }
      }
    );
  }

  const joinUrl = `${window.location.origin}/join?code=${roomCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-4 sm:p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-2xl text-white font-extrabold">Room code</h1>
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
        <p className="font-mono text-4xl font-bold text-chain-locked tracking-widest">{roomCode}</p>
        <QRCodeSVG value={joinUrl} size={140} aria-label="Room QR code" />
      </div>

      <div className="bg-white/95 rounded-2xl p-6 w-full max-w-md">
        <h2 className="font-display text-lg font-bold text-chain-locked mb-3">
          Players ({players.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.socketId} className="flex items-center justify-between">
              <span className="text-chain-locked">{player.nickname}</span>
              <button
                type="button"
                onClick={() => handleKick(player.socketId)}
                aria-label={`Kick ${player.nickname}`}
                className="text-red-600 text-sm font-semibold"
              >
                Kick
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full px-8 py-3 font-display font-extrabold text-chain-locked"
      >
        Start Game
      </button>
    </div>
  );
}
