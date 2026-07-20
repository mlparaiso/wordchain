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
    if (!room || room.hostSocketId === socket.id) return;

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
