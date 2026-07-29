import { useEffect, useState } from "react";
import type {
  GameMode,
  PlayerInfo,
  Puzzle,
  PublicBoardView,
  RoundResult,
  RoundStartedPayload,
  TeamInfo,
} from "@wordchain/shared";
import { toPublicRows } from "@wordchain/shared";
import { getSessionToken, getSocket } from "./socket.js";
import { JoinPage, type JoinedData } from "./pages/JoinPage.js";
import { HostSetupPage } from "./pages/HostSetupPage.js";
import { CustomPuzzleCreatorPage } from "./pages/CustomPuzzleCreatorPage.js";
import { HostLobbyPage } from "./pages/HostLobbyPage.js";
import { PlayerLobbyPage } from "./pages/PlayerLobbyPage.js";
import { PlayerRoundPage } from "./pages/PlayerRoundPage.js";
import { HostRoundPage } from "./pages/HostRoundPage.js";
import { ResultsPage } from "./pages/ResultsPage.js";
import { SoloDifficultyPage } from "./pages/SoloDifficultyPage.js";
import { SoloRoundPage, type SoloRunSummary } from "./pages/SoloRoundPage.js";
import { SoloResultsPage } from "./pages/SoloResultsPage.js";

export type Role = "host" | "player";

export type Screen =
  | { name: "landing" }
  | { name: "join" }
  | { name: "hostSetup" }
  | { name: "customPuzzleCreator" }
  | { name: "hostLobby" }
  | { name: "playerLobby" }
  | { name: "round"; role: Role }
  | { name: "results"; role: Role }
  | { name: "soloDifficulty" }
  | { name: "soloRound" }
  | { name: "soloResults" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "landing" });
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("individual");
  const [playlist, setPlaylist] = useState<Puzzle[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<PlayerInfo[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [roundData, setRoundData] = useState<RoundStartedPayload | null>(null);
  const [reconnectBoardView, setReconnectBoardView] = useState<PublicBoardView | null>(null);
  const [lastResults, setLastResults] = useState<{ results: RoundResult[]; totals: Record<string, number> } | null>(
    null
  );
  const [soloPuzzle, setSoloPuzzle] = useState<Puzzle | null>(null);
  const [soloSummary, setSoloSummary] = useState<SoloRunSummary | null>(null);
  const [playerSession, setPlayerSession] = useState<{ code: string; nickname: string } | null>(null);

  // Socket.IO auto-reconnects the transport after a drop (phone lock, wifi blip), but issues
  // a new socket.id and doesn't know which room/nickname we had. Without this, a player who
  // gets reconnected silently loses their room membership until they manually rejoin.
  useEffect(() => {
    if (!playerSession) return;
    const socket = getSocket();
    function handleReconnect() {
      if (!playerSession) return;
      socket.emit(
        "player:joinRoom",
        { code: playerSession.code, nickname: playerSession.nickname, sessionToken: getSessionToken() },
        (response: JoinedData & { success: boolean; error?: string }) => {
          if (!response.success) {
            // The room's gone (host ended the session, or our grace period expired) while
            // we were offline — nothing to rejoin, so don't leave the player stranded on
            // whatever screen they were last on.
            setPlayerSession(null);
            setScreen({ name: "landing" });
            return;
          }
          setMode(response.mode);
          setTeams(response.teams);
          setMyTeamId(response.teamId ?? null);
          if (response.activeRound) {
            setRoundData(response.activeRound as RoundStartedPayload);
            setReconnectBoardView((response.boardView as PublicBoardView) ?? null);
            setScreen({ name: "round", role: "player" });
          } else {
            // The round ended while we were offline. There's no way to know whether we
            // should be looking at results or waiting for the next round, so land
            // somewhere safe that picks up the next round:started on its own, rather than
            // leaving the player stuck on a round screen that will never update again.
            setScreen({ name: "playerLobby" });
          }
        }
      );
    }
    socket.io.on("reconnect", handleReconnect);
    return () => {
      socket.io.off("reconnect", handleReconnect);
    };
  }, [playerSession]);

  // If the host's connection drops, the server tears the room down (it has no host-reconnect
  // path today) and tells whoever's left so they aren't stuck staring at a dead screen.
  useEffect(() => {
    const socket = getSocket();
    function handleHostLeft() {
      setPlayerSession(null);
      setScreen({ name: "landing" });
    }
    socket.on("room:hostLeft", handleHostLeft);
    return () => {
      socket.off("room:hostLeft", handleHostLeft);
    };
  }, []);

  // The host can end a session (from the final results screen) with their socket still
  // connected, so — unlike room:hostLeft — nothing would otherwise tell a player still
  // sitting on that screen that the game is over; they'd be stuck there indefinitely.
  useEffect(() => {
    const socket = getSocket();
    function handleSessionEnded() {
      setPlayerSession(null);
      setScreen({ name: "landing" });
    }
    socket.on("room:sessionEnded", handleSessionEnded);
    return () => {
      socket.off("room:sessionEnded", handleSessionEnded);
    };
  }, []);

  if (screen.name === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-4xl text-white font-extrabold">Word Chain</h1>
          <p className="text-white/80 font-body">Chain each word to the next — every pair makes a real phrase.</p>
        </div>
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
        <button
          type="button"
          onClick={() => setScreen({ name: "soloDifficulty" })}
          className="text-white/80 text-sm font-semibold underline"
        >
          Practice Solo
        </button>
      </div>
    );
  }

  if (screen.name === "join") {
    return (
      <JoinPage
        onJoined={(data) => {
          setPlayerSession({ code: data.code, nickname: data.nickname });
          setMode(data.mode);
          setTeams(data.teams);
          setMyTeamId(data.teamId);
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
        onStarted={(puzzle, players) => {
          setCurrentPuzzleIndex(0);
          setKnownPlayers(players);
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
        players={knownPlayers}
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
            getSocket().emit("host:endSession", {}, () => {});
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

  if (screen.name === "soloDifficulty") {
    return (
      <SoloDifficultyPage
        onPuzzleChosen={(puzzle) => {
          setSoloPuzzle(puzzle);
          setScreen({ name: "soloRound" });
        }}
        onBack={() => setScreen({ name: "landing" })}
      />
    );
  }

  if (screen.name === "soloRound" && soloPuzzle) {
    return (
      <SoloRoundPage
        puzzle={soloPuzzle}
        onFinished={(summary) => {
          setSoloSummary(summary);
          setScreen({ name: "soloResults" });
        }}
        onQuit={() => setScreen({ name: "landing" })}
      />
    );
  }

  if (screen.name === "soloResults" && soloSummary) {
    return (
      <SoloResultsPage
        summary={soloSummary}
        onPlayAgain={() => setScreen({ name: "soloDifficulty" })}
        onBackToMenu={() => setScreen({ name: "landing" })}
      />
    );
  }

  return null;
}
