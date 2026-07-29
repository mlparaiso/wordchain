import type { Server, Socket } from "socket.io";
import type { GameMode, TeamInfo } from "@wordchain/shared";
import { toPublicBoardView, toPublicRows } from "@wordchain/shared";
import type { Room } from "../rooms/Room.js";
import type { RoomManager } from "../rooms/RoomManager.js";

export interface JoinRoomPayload {
  code: string;
  nickname: string;
  sessionToken?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  error?: string;
  mode?: GameMode;
  teams?: TeamInfo[];
  teamId?: string | null;
  activeRound?: {
    puzzleId: string;
    category: string;
    timeCapSeconds: number;
    rows: ReturnType<typeof toPublicRows>;
    startedAt: number;
    isLastRound: boolean;
  };
  boardView?: ReturnType<typeof toPublicBoardView>;
}

function buildActiveRoundAck(room: Room, socketId: string) {
  if (!room.currentRound) return {};
  let entrantId: string;
  try {
    entrantId = room.getEntrantId(socketId);
  } catch {
    return {};
  }
  const chainState = room.currentRound.entrantChains.get(entrantId);
  if (!chainState) return {};
  return {
    activeRound: {
      puzzleId: room.currentRound.puzzle.id,
      category: room.currentRound.puzzle.category,
      timeCapSeconds: room.currentRound.puzzle.timeCapSeconds,
      rows: toPublicRows(room.currentRound.puzzle.words),
      startedAt: room.currentRound.startedAt,
      isLastRound: room.currentRound.isLastRound,
    },
    boardView: toPublicBoardView(chainState),
  };
}

export function registerPlayerHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "player:joinRoom",
    (payload: JoinRoomPayload, callback: (response: JoinRoomResponse) => void) => {
      const room = roomManager.getRoom(payload.code);
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }

      const reconnected = room.reconnectPlayer(payload.nickname, socket.id, payload.sessionToken);
      if (reconnected) {
        socket.join(room.code);
        socket.data.roomCode = room.code;
        io.to(room.code).emit("room:playerUpdated", reconnected);
        callback({
          success: true,
          mode: room.mode,
          teams: room.teams,
          teamId: reconnected.teamId,
          ...buildActiveRoundAck(room, socket.id),
        });
        return;
      }

      const player = room.addPlayer(socket.id, payload.nickname, payload.sessionToken);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.to(room.code).emit("room:playerJoined", player);
      callback({
        success: true,
        mode: room.mode,
        teams: room.teams,
        teamId: player.teamId,
        ...buildActiveRoundAck(room, socket.id),
      });
    }
  );

  socket.on(
    "player:selectTeam",
    (payload: { teamId: string }, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      try {
        room.assignTeam(socket.id, payload.teamId);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const updatedPlayer = room.getPlayers().find((p) => p.socketId === socket.id)!;
      io.to(room.code).emit("room:playerUpdated", updatedPlayer);
      callback({ success: true });
    }
  );
}
