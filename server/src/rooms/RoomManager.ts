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
    while (this.rooms.has(code)) {
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
