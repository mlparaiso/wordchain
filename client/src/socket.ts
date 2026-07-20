import { io, type Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL);
  }
  return socket;
}

// Identifies this browser tab's session to the server so a reconnect (or a deliberate
// rejoin after a dropped connection) can be told apart from a different person who
// happens to pick the same nickname. Generated once per tab, never persisted.
let sessionToken: string | undefined;

export function getSessionToken(): string {
  if (!sessionToken) {
    sessionToken =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return sessionToken;
}
