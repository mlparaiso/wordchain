import { Room } from "./Room.js";
import { generateRoomCode } from "./roomCode.js";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private randomFn: () => number;

  constructor(randomFn: () => number = Math.random) {
    this.randomFn = randomFn;
  }

  createRoom(hostSocketId: string): Room {
    let code = generateRoomCode(this.randomFn);
    let attempts = 0;
    while (this.rooms.has(code)) {
      attempts++;
      if (attempts > 100) {
        // The adjective/number code space is small (720 combinations) and could theoretically
        // be exhausted by long-lived rooms; fall back to a wider, effectively-unique code
        // rather than looping forever.
        code = `${generateRoomCode(this.randomFn)}-${Math.floor(this.randomFn() * 10000)}`;
        break;
      }
      code = generateRoomCode(this.randomFn);
    }
    const room = new Room(code, hostSocketId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}
