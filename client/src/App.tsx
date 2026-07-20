import { useState } from "react";
import type { GameMode, Puzzle, PublicBoardView, RoundResult, RoundStartedPayload, TeamInfo } from "@wordchain/shared";
import { toPublicRows } from "@wordchain/shared";
import { getSocket } from "./socket.js";
import { JoinPage } from "./pages/JoinPage.js";
import { HostSetupPage } from "./pages/HostSetupPage.js";
import { CustomPuzzleCreatorPage } from "./pages/CustomPuzzleCreatorPage.js";
import { HostLobbyPage } from "./pages/HostLobbyPage.js";
import { PlayerLobbyPage } from "./pages/PlayerLobbyPage.js";
import { PlayerRoundPage } from "./pages/PlayerRoundPage.js";
import { HostRoundPage } from "./pages/HostRoundPage.js";
import { ResultsPage } from "./pages/ResultsPage.js";

export type Role = "host" | "player";

export type Screen =
  | { name: "landing" }
  | { name: "join" }
  | { name: "hostSetup" }
  | { name: "customPuzzleCreator" }
  | { name: "hostLobby" }
  | { name: "playerLobby" }
  | { name: "round"; role: Role }
  | { name: "results"; role: Role };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "landing" });
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("individual");
  const [playlist, setPlaylist] = useState<Puzzle[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [roundData, setRoundData] = useState<RoundStartedPayload | null>(null);
  const [reconnectBoardView, setReconnectBoardView] = useState<PublicBoardView | null>(null);
  const [lastResults, setLastResults] = useState<{ results: RoundResult[]; totals: Record<string, number> } | null>(
    null
  );

  if (screen.name === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6">
        <h1 className="font-display text-4xl text-white font-extrabold">Word Chain</h1>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setScreen({ name: "hostSetup" })}
            className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-6 py-3 font-display font-extrabold text-chain-locked"
          >
            Host a game
          </button>
          <button
            type="button"
            onClick={() => setScreen({ name: "join" })}
            className="bg-white shadow-[0_4px_0_#cccccc] rounded-full px-6 py-3 font-display font-extrabold text-chain-locked"
          >
            Join a game
          </button>
        </div>
      </div>
    );
  }

  if (screen.name === "join") {
    return (
      <JoinPage
        onJoined={(data) => {
          setMode(data.mode);
          setTeams(data.teams);
          if (data.activeRound) {
            setRoundData(data.activeRound as RoundStartedPayload);
            setReconnectBoardView((data.boardView as PublicBoardView) ?? null);
            setScreen({ name: "round", role: "player" });
          } else {
            setScreen({ name: "playerLobby" });
          }
        }}
      />
    );
  }

  if (screen.name === "hostSetup") {
    return (
      <HostSetupPage
        onOpenCreator={() => setScreen({ name: "customPuzzleCreator" })}
        onRoomCreated={(data) => {
          setRoomCode(data.code);
          setMode(data.mode);
          setPlaylist(data.playlist);
          setScreen({ name: "hostLobby" });
        }}
      />
    );
  }

  if (screen.name === "customPuzzleCreator") {
    return (
      <CustomPuzzleCreatorPage
        onSaved={() => setScreen({ name: "hostSetup" })}
        onCancel={() => setScreen({ name: "hostSetup" })}
      />
    );
  }

  if (screen.name === "hostLobby" && roomCode) {
    return (
      <HostLobbyPage
        roomCode={roomCode}
        playlist={playlist}
        onStarted={(puzzle) => {
          setCurrentPuzzleIndex(0);
          setRoundData({
            puzzleId: puzzle.id,
            category: puzzle.category,
            timeCapSeconds: puzzle.timeCapSeconds,
            rows: toPublicRows(puzzle.words),
            startedAt: Date.now(),
            isLastRound: playlist.length === 1,
          });
          setScreen({ name: "round", role: "host" });
        }}
      />
    );
  }

  if (screen.name === "playerLobby") {
    return (
      <PlayerLobbyPage
        mode={mode}
        teams={teams}
        onTeamSelected={(teamId) => setMyTeamId(teamId)}
        onRoundStarted={(payload) => {
          setRoundData(payload);
          setScreen({ name: "round", role: "player" });
        }}
      />
    );
  }

  if (screen.name === "round" && screen.role === "player" && roundData) {
    return (
      <PlayerRoundPage
        roundData={roundData}
        mode={mode}
        myTeamId={myTeamId}
        initialBoardView={reconnectBoardView ?? undefined}
        onResults={(payload) => {
          setReconnectBoardView(null);
          setLastResults(payload);
          setScreen({ name: "results", role: "player" });
        }}
      />
    );
  }

  if (screen.name === "round" && screen.role === "host" && roundData) {
    return (
      <HostRoundPage
        roundData={roundData}
        mode={mode}
        teams={teams}
        onResults={(payload) => {
          setLastResults(payload);
          setScreen({ name: "results", role: "host" });
        }}
      />
    );
  }

  if (screen.name === "results" && screen.role === "host" && lastResults) {
    const isLastRound = currentPuzzleIndex + 1 >= playlist.length;
    return (
      <ResultsPage
        results={lastResults.results}
        totals={lastResults.totals}
        role="host"
        isLastRound={isLastRound}
        onAdvance={() => {
          if (isLastRound) {
            setScreen({ name: "landing" });
            return;
          }
          const nextIndex = currentPuzzleIndex + 1;
          const nextPuzzle = playlist[nextIndex];
          getSocket().emit(
            "host:startRound",
            { puzzle: nextPuzzle, isLastRound: nextIndex === playlist.length - 1 },
            () => {
              setCurrentPuzzleIndex(nextIndex);
              setRoundData({
                puzzleId: nextPuzzle.id,
                category: nextPuzzle.category,
                timeCapSeconds: nextPuzzle.timeCapSeconds,
                rows: toPublicRows(nextPuzzle.words),
                startedAt: Date.now(),
                isLastRound: nextIndex === playlist.length - 1,
              });
              setScreen({ name: "round", role: "host" });
            }
          );
        }}
      />
    );
  }

  if (screen.name === "results" && screen.role === "player" && lastResults) {
    return (
      <ResultsPage
        results={lastResults.results}
        totals={lastResults.totals}
        role="player"
        isLastRound={roundData?.isLastRound ?? false}
        onNextRoundStarted={(payload) => {
          setRoundData(payload);
          setScreen({ name: "round", role: "player" });
        }}
      />
    );
  }

  return null;
}
