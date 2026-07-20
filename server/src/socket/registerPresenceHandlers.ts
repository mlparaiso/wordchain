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
      io.to(room.code).emit("room:hostLeft", {});
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
