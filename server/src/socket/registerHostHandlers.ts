import type { Server, Socket } from "socket.io";
import type { GameMode, TeamInfo } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

export interface CreateRoomPayload {
  mode: GameMode;
  teams?: TeamInfo[];
}

export interface CreateRoomResponse {
  code?: string;
  error?: string;
}

export function registerHostHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "host:createRoom",
    (payload: CreateRoomPayload, callback: (response: CreateRoomResponse) => void) => {
      const room = roomManager.createRoom(socket.id);
      room.mode = payload.mode;
      if (payload.teams) room.teams = payload.teams;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      callback({ code: room.code });
    }
  );

  socket.on(
    "host:kickPlayer",
    (payload: { socketId: string }, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can kick players" });
        return;
      }
      if (!room.getPlayers().some((p) => p.socketId === payload.socketId)) {
        callback({ success: false, error: "That player is not in your room" });
        return;
      }
      room.removePlayer(payload.socketId);
      io.to(room.code).emit("room:playerLeft", { socketId: payload.socketId });
      io.sockets.sockets.get(payload.socketId)?.disconnect(true);
      callback({ success: true });
    }
  );
}
