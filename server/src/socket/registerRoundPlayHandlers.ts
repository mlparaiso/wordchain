import type { Server, Socket } from "socket.io";
import { applyHint, isComplete, submitGuess, toPublicBoardView } from "@wordchain/shared";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { Room } from "../rooms/Room.js";

function resolveActiveRoom(socket: Socket, roomManager: RoomManager): Room | undefined {
  const roomCode = socket.data.roomCode as string | undefined;
  const room = roomCode ? roomManager.getRoom(roomCode) : undefined;
  return room?.currentRound ? room : undefined;
}

export function registerRoundPlayHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(
    "player:submitGuess",
    (
      payload: { rowIndex: number; guess: string },
      callback: (response: { success: boolean; correct?: boolean; error?: string }) => void
    ) => {
      const room = resolveActiveRoom(socket, roomManager);
      if (!room) {
        callback({ success: false, error: "No active round" });
        return;
      }
      let entrantId: string;
      try {
        entrantId = room.getEntrantId(socket.id);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const chainState = room.currentRound!.entrantChains.get(entrantId);
      if (!chainState) {
        callback({ success: false, error: "No board found for this player" });
        return;
      }

      let result;
      try {
        result = submitGuess(chainState, payload.rowIndex, payload.guess);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }

      room.currentRound!.entrantChains.set(entrantId, result.state);
      io.to(room.code).emit("board:updated", { entrantId, view: toPublicBoardView(result.state) });

      if (result.correct) {
        const player = room.getPlayers().find((p) => p.socketId === socket.id);
        io.to(room.code).emit("round:activity", {
          type: "correct",
          entrantId,
          nickname: player?.nickname ?? "Someone",
          rowIndex: payload.rowIndex,
          word: payload.guess.trim().toUpperCase(),
        });
      }

      if (result.correct && isComplete(result.state) && !room.currentRound!.finishedAt.has(entrantId)) {
        room.currentRound!.finishedAt.set(entrantId, Date.now());
        io.to(room.code).emit("player:chainComplete", { entrantId });
      }

      callback({ success: true, correct: result.correct });
    }
  );

  socket.on(
    "player:useHint",
    (payload: { rowIndex: number }, callback: (response: { success: boolean; error?: string }) => void) => {
      const room = resolveActiveRoom(socket, roomManager);
      if (!room) {
        callback({ success: false, error: "No active round" });
        return;
      }
      let entrantId: string;
      try {
        entrantId = room.getEntrantId(socket.id);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }
      const chainState = room.currentRound!.entrantChains.get(entrantId);
      if (!chainState) {
        callback({ success: false, error: "No board found for this player" });
        return;
      }

      let nextState;
      try {
        nextState = applyHint(chainState, payload.rowIndex);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
        return;
      }

      room.currentRound!.entrantChains.set(entrantId, nextState);
      io.to(room.code).emit("board:updated", { entrantId, view: toPublicBoardView(nextState) });

      const player = room.getPlayers().find((p) => p.socketId === socket.id);
      io.to(room.code).emit("round:activity", {
        type: "hint",
        entrantId,
        nickname: player?.nickname ?? "Someone",
        rowIndex: payload.rowIndex,
      });

      callback({ success: true });
    }
  );

  socket.on("player:typing", (payload: { rowIndex: number }) => {
    const room = resolveActiveRoom(socket, roomManager);
    if (!room) return;
    let entrantId: string;
    try {
      entrantId = room.getEntrantId(socket.id);
    } catch {
      return;
    }
    const player = room.getPlayers().find((p) => p.socketId === socket.id);
    socket.to(room.code).emit("board:typing", {
      entrantId,
      nickname: player?.nickname ?? "Someone",
      rowIndex: payload.rowIndex,
    });
  });
}
