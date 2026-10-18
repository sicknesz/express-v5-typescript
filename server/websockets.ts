import { Server as WebsocketServer } from "socket.io"
import { log } from "./app.ts"
import type { Server as HttpServer } from "node:http";
import { AuthenticationError } from './errors.ts'
import jwt from "jsonwebtoken"

export function initWebsocket(server: HttpServer) {
  /**
   * Create socket.io server.
   */
  const io = new WebsocketServer(server, { path: "/sockets", transports: ["websocket", "polling"] });

  /**
   * Accept websocket connection from client
   */
  io.on("connection", (socket) => {
    socket.conn.on("upgrade", (transport) => {
      log.debug(`[Socket.io]: transport upgraded to ${transport.name}`);
    });

    socket.on("disconnect", (reason) => {
      log.debug(`[Socket.io]: disconnected due to ${reason}`);
    });

    // TODO : create a unique id/uuid for each client    
    socket.emit("connected", "hello from server")
  })

  // websocket client connection auth handle
  io.use((socket, next) => {

    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new AuthenticationError('Token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      // socket.user = decoded; 
      log.debug(decoded, "[Socket.io][jwt]: socket.io client authed");
      next();
    } catch (error: unknown) {
      if (error instanceof Error) {
        return next(error);
      }
      socket.emit("disconnect");
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.on("connect_error", (err) => {
      // { name: 'TRANSPORT_MISMATCH', transport: 'websocket', previousTransport: 'polling' }
      log.error("[Socket.io][ERROR]: ", err.code, err.message, err.context);
    });
  });

  return io;
}

