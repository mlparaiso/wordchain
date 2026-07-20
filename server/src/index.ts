import { createServer as createHttpServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager.js";
import { registerHostHandlers } from "./socket/registerHostHandlers.js";
import { registerPlayerHandlers } from "./socket/registerPlayerHandlers.js";
import { registerHostRoundHandlers } from "./socket/registerHostRoundHandlers.js";
import { registerRoundPlayHandlers } from "./socket/registerRoundPlayHandlers.js";
import { registerPresenceHandlers } from "./socket/registerPresenceHandlers.js";

const DEFAULT_PRESENCE_GRACE_PERIOD_MS = 60_000;

export function createServer(options?: { presenceGracePeriodMs?: number }) {
  const presenceGracePeriodMs = options?.presenceGracePeriodMs ?? DEFAULT_PRESENCE_GRACE_PERIOD_MS;
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? "*" },
  });
  const roomManager = new RoomManager();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  io.on("connection", (socket) => {
    registerHostHandlers(io, socket, roomManager);
    registerPlayerHandlers(io, socket, roomManager);
    registerHostRoundHandlers(io, socket, roomManager);
    registerRoundPlayHandlers(io, socket, roomManager);
    registerPresenceHandlers(io, socket, roomManager, presenceGracePeriodMs);
  });

  return { app, httpServer, io, roomManager };
}

// Only start listening when this file is run directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpServer } = createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  httpServer.listen(port, () => {
    console.log(`Word Chain server listening on port ${port}`);
  });
}
