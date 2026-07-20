import { createServer as createHttpServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager.js";

export function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  const roomManager = new RoomManager();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
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
