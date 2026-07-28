import type { Server, Socket } from "socket.io";
import { toPublicBoardView, toPublicRows, validatePuzzleWords, type Puzzle } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";
import { endRound } from "../rooms/scoreRound.js";
import { emitToRoundEventRecipients } from "./roundEventRecipients.js";

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
      if (room.currentRound) {
        callback({ success: false, error: "A round is already in progress" });
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

      // Each chain starts with its middle blank(s) already showing a free first letter
      // (see createChainState) — clients can't compute that themselves since they don't
      // know the answer words, so push the real initial view rather than letting a
      // client's own guess (all-blank) stand until its first board:updated.
      for (const [entrantId, chainState] of room.currentRound!.entrantChains) {
        emitToRoundEventRecipients(io, room, entrantId, "board:updated", {
          entrantId,
          view: toPublicBoardView(chainState),
        });
      }

      room.currentRound!.timeoutHandle = setTimeout(
        () => endRound(io, room),
        payload.puzzle.timeCapSeconds * 1000
      );
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

  socket.on(
    "host:endSession",
    (_payload: Record<string, never>, callback: (response: { success: boolean; error?: string }) => void) => {
      const roomCode = socket.data.roomCode as string | undefined;
      const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }
      if (room.hostSocketId !== socket.id) {
        callback({ success: false, error: "Only the host can end the session" });
        return;
      }
      if (room.currentRound?.timeoutHandle) clearTimeout(room.currentRound.timeoutHandle);

      io.to(room.code).emit("room:sessionEnded", {});
      // Without this, the host's socket stays subscribed to this room's broadcasts even
      // after hosting a new one — a departing player's later disconnect update would leak
      // into the new room's live board grid (they never emit anything scoped by room code).
      io.in(room.code).socketsLeave(room.code);
      socket.data.roomCode = undefined;
      roomManager.removeRoom(room.code);
      callback({ success: true });
    }
  );
}
