import type { Server, Socket } from "socket.io";
import type { RoomManager } from "../rooms/RoomManager.js";

export function registerPresenceHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  gracePeriodMs: number
): void {
  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode as string | undefined;
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    if (room.hostSocketId === socket.id) {
      // The host has no reconnection path today, so a room they've left behind would
      // otherwise never be cleaned up. Tear it down and let remaining players know.
      // Mirrors host:endSession's teardown: clear any pending round timeout (otherwise
      // it fires later against this now-torn-down room, wasting the round's memory and
      // broadcasting a stray round:results) and evict remaining sockets from the room's
      // broadcast channel (otherwise a later stray emit — including that same orphaned
      // timeout — could leak into a new session that happens to reuse this room code).
      if (room.currentRound?.timeoutHandle) clearTimeout(room.currentRound.timeoutHandle);
      io.to(room.code).emit("room:hostLeft", {});
      io.in(room.code).socketsLeave(room.code);
      roomManager.removeRoom(room.code);
      return;
    }

    room.setConnected(socket.id, false);
    const player = room.getPlayers().find((p) => p.socketId === socket.id);
    if (player) io.to(room.code).emit("room:playerUpdated", player);

    setTimeout(() => {
      const stillThere = room.getPlayers().find((p) => p.socketId === socket.id);
      if (stillThere && !stillThere.connected) {
        room.removePlayer(socket.id);
        io.to(room.code).emit("room:playerLeft", { socketId: socket.id });
      }
    }, gracePeriodMs);
  });
}
