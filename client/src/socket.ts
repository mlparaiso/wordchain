import { io, type Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL);
  }
  return socket;
}
