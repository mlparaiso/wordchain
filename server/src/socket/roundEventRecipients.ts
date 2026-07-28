import type { Server } from "socket.io";
import type { Room } from "../rooms/Room.js";

// The board and puzzle answers are shared across every entrant in a room, so an entrant's
// progress (revealed letters, solved words, hints used) must never broadcast to entrants
// outside their own team (or, in individual mode, to anyone but themselves) — otherwise
// they'd be handed answers other entrants have already worked out. The host is always
// included since they're trusted to see every entrant's board.
export function roundEventRecipients(room: Room, entrantId: string): string[] {
  const recipients =
    room.mode === "team"
      ? room.getPlayers().filter((p) => p.teamId === entrantId).map((p) => p.socketId)
      : [entrantId];
  return [...new Set([...recipients, room.hostSocketId])];
}

export function emitToRoundEventRecipients(
  io: Server,
  room: Room,
  entrantId: string,
  event: string,
  payload: unknown
): void {
  for (const socketId of roundEventRecipients(room, entrantId)) {
    io.to(socketId).emit(event, payload);
  }
}
