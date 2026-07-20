import { createChainState, type ChainState, type GameMode, type PlayerInfo, type Puzzle, type TeamInfo } from "@wordchain/shared";

export interface RoundState {
  puzzle: Puzzle;
  startedAt: number;
  entrantChains: Map<string, ChainState>;
  finishedAt: Map<string, number>;
  isLastRound: boolean;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

export class Room {
  code: string;
  hostSocketId: string;
  mode: GameMode = "individual";
  teams: TeamInfo[] = [];
  currentRound: RoundState | null = null;
  totalPoints: Map<string, number> = new Map();
  private players = new Map<string, PlayerInfo>();
  // Kept out of PlayerInfo (and therefore out of every room:player* broadcast) so a
  // player's reconnect token is never visible to other clients in the room.
  private sessionTokens = new Map<string, string>();

  constructor(code: string, hostSocketId: string) {
    this.code = code;
    this.hostSocketId = hostSocketId;
  }

  addPlayer(socketId: string, nickname: string, sessionToken?: string): PlayerInfo {
    const player: PlayerInfo = { socketId, nickname, teamId: null, connected: true };
    this.players.set(socketId, player);
    if (sessionToken) this.sessionTokens.set(socketId, sessionToken);
    return player;
  }

  removePlayer(socketId: string): void {
    this.players.delete(socketId);
    this.sessionTokens.delete(socketId);
  }

  setConnected(socketId: string, connected: boolean): void {
    const player = this.players.get(socketId);
    if (player) player.connected = connected;
  }

  assignTeam(socketId: string, teamId: string): void {
    const player = this.players.get(socketId);
    if (!player) throw new Error(`Player ${socketId} does not exist`);
    if (!this.teams.some((t) => t.id === teamId)) {
      throw new Error(`Team ${teamId} does not exist`);
    }
    player.teamId = teamId;
  }

  getPlayers(): PlayerInfo[] {
    return [...this.players.values()];
  }

  reconnectPlayer(nickname: string, newSocketId: string, sessionToken?: string): PlayerInfo | null {
    const existingEntry = [...this.players.entries()].find(
      ([socketId, p]) =>
        p.nickname === nickname && !p.connected && this.sessionTokens.get(socketId) === sessionToken
    );
    if (!existingEntry) return null;

    const [oldSocketId, oldPlayer] = existingEntry;
    this.players.delete(oldSocketId);
    const reconnected: PlayerInfo = { ...oldPlayer, socketId: newSocketId, connected: true };
    this.players.set(newSocketId, reconnected);

    const token = this.sessionTokens.get(oldSocketId);
    this.sessionTokens.delete(oldSocketId);
    if (token) this.sessionTokens.set(newSocketId, token);

    if (this.currentRound) {
      const chainState = this.currentRound.entrantChains.get(oldSocketId);
      if (chainState) {
        this.currentRound.entrantChains.delete(oldSocketId);
        this.currentRound.entrantChains.set(newSocketId, chainState);
      }
      if (this.currentRound.finishedAt.has(oldSocketId)) {
        const finishedAtMs = this.currentRound.finishedAt.get(oldSocketId)!;
        this.currentRound.finishedAt.delete(oldSocketId);
        this.currentRound.finishedAt.set(newSocketId, finishedAtMs);
      }
    }

    return reconnected;
  }

  getEntrantId(socketId: string): string {
    const player = this.players.get(socketId);
    if (!player) throw new Error(`Player ${socketId} does not exist`);
    if (this.mode === "team") {
      if (!player.teamId) throw new Error(`Player ${socketId} has not selected a team`);
      return player.teamId;
    }
    return socketId;
  }

  startRound(puzzle: Puzzle, isLastRound = false): void {
    const entrantChains = new Map<string, ChainState>();
    for (const player of this.players.values()) {
      if (this.mode === "team" && !player.teamId) continue;
      const entrantId = this.getEntrantId(player.socketId);
      if (!entrantChains.has(entrantId)) {
        entrantChains.set(entrantId, createChainState(puzzle.words));
      }
    }
    this.currentRound = {
      puzzle,
      startedAt: Date.now(),
      entrantChains,
      finishedAt: new Map(),
      isLastRound,
      timeoutHandle: null,
    };
  }

  getDisplayName(entrantId: string): string {
    if (this.mode === "team") {
      const team = this.teams.find((t) => t.id === entrantId);
      if (team) return team.name;
    }
    const player = this.players.get(entrantId);
    return player?.nickname ?? entrantId;
  }
}
