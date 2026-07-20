import type { Server, Socket } from "socket.io";
import { toPublicRows, validatePuzzleWords, type Puzzle } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";
import { endRound } from "../rooms/scoreRound.js";

export function registerHostRoundHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "host:startRound",
    (
      payload: { puzzle: Puzzle; isLastRound?: boolean },
      callback: (response: { success: boolean; error?: string }) => void
    ) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can start a round" });
        return;
      }
      const errors = validatePuzzleWords(payload.puzzle.words);
      if (errors.length > 0) {
        callback({ success: false, error: errors[0].message });
        return;
      }

      room.startRound(payload.puzzle, payload.isLastRound ?? false);

      io.to(room.code).emit("round:started", {
        puzzleId: payload.puzzle.id,
        category: payload.puzzle.category,
        timeCapSeconds: payload.puzzle.timeCapSeconds,
        rows: toPublicRows(payload.puzzle.words),
        startedAt: room.currentRound!.startedAt,
        isLastRound: payload.isLastRound ?? false,
      });

      setTimeout(() => endRound(io, room), payload.puzzle.timeCapSeconds * 1000);
      callback({ success: true });
    }
  );

  socket.on(
    "host:endRound",
    (_payload: Record<string, never>, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can end a round" });
        return;
      }
      endRound(io, room);
      callback({ success: true });
    }
  );
}
