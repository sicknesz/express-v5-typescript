import { Server as WebsocketServer } from "socket.io"
import { log } from "./app.ts"
import { createServer } from "node:http";
import type { Express } from "express"
import { AuthenticationError } from './errors.ts'
import jwt from "jsonwebtoken"
import vm from "node:vm"
import { it, describe } from "node:test";
import assert from "node:assert";

interface ServerToClientEvents<E> {
  ['sandbox:execute:result']: ({ returned }: { returned: string }) => void;
  ['sandbox:execute:error']: ({ error }: { error: E }) => void;
}
interface ClientToServerEvents {
  ['sandbox:execute:request']: ({ code, testCode, clientId }: { code: string, testCode: string, clientId: string }) => void;
}

interface SocketData {
  authenticated: boolean;
}


export function initWebsocket(app: Express) {

  const httpServer = createServer(app);

  /**
   * Create socket.io server.
   */
  const io = new WebsocketServer<ClientToServerEvents, ServerToClientEvents<Error>, SocketData>(httpServer);

  // server-side
  io.on("connection", (socket) => {
    log.debug(`[Socket.io]: client : ${socket.id}`);

    socket.conn.on("upgrade", (transport) => {
      log.debug(`[Socket.io]: transport upgraded to ${transport.name}`);
    });


    socket.on("disconnect", (reason) => {
      log.debug(`[Socket.io]: disconnected due to ${reason}`);
    });

    socket.on("sandbox:execute:request", async ({ code, testCode, clientId }) => {
      if (!socket.data.authenticated) {
        throw new AuthenticationError("[socket.io]: unauthorized");
      }
      log.debug(`[Socket.io]: Got execute request from ${clientId}`, code, testCode);

      const timeoutMs = 30000;

      const stdout: string[] = [];
      const stderr: string[] = [];
      // const exitCode: number = 0;

      const deadLine = Date.now() + timeoutMs;

      const error = (...args: any[]) => {
        if (Date.now() > deadLine) {
          return;
        }
        console.log("[SANDBOX]:", ...args);
        stderr.push(...args);
      }

      const logger = (...args: any[]) => {
        if (Date.now() > deadLine) {
          return;
        }
        console.log("[SANDBOX]:", ...args);
        stdout.push(...args);
      }

      const context = {
        ...process,
        it,
        describe,
        assert,
        console: {
          log: logger,
          warn: logger,
          error: error,
          info: logger
        }
      };

      log.debug("[SANDBOX]: Created context for script ");

      const contextified = vm.createContext(context);

      const finalCode = ` 
        ${code}\n
        ${testCode}\n;
      `;

      log.debug("[SANDBOX]: Created script sandbox from source code", finalCode);
      const script = new vm.Script(finalCode);

      log.debug("[SANDBOX]: Running script inside sandbox");
      const lastStatement = await script.runInContext(contextified, {
        timeout: timeoutMs
      })

      log.debug(code, "[SANDBOX]: Executed script, last statement returned : ", lastStatement);
      log.debug(code, "[SANDBOX]: stderr : ", stderr);
      log.debug(code, "[SANDBOX]: stdout : ", stdout);

    });
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token !== "secret") {
      throw new AuthenticationError("[socket.io]: unauthorized");
    }
    log.debug("[socket.io]: client : " + socket.id + " is authenticated")
    socket.data.authenticated = true;
    next();
  });

  /**
   * Accept websocket connection from client
   
  io.on("connection", (socket) => {
    socket.conn.on("upgrade", (transport) => {
      log.debug(`[Socket.io]: transport upgraded to ${transport.name}`);
    });
  
    socket.on("disconnect", (reason) => {
      log.debug(`[Socket.io]: disconnected due to ${reason}`);
    });
  
    // TODO : create a unique id/uuid for each client    
    socket.emit("connected", { clientId: v4() });
  })
  
  // websocket client connection auth handle
  io.use((socket, next) => {
  
    log.debug(`[Socket.io]: attempt to auth client`);
  
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
      log.error("[Socket.io][ERROR]: ", err.code, err.message, err.context);
    });
  
  
    socket.on("sandbox:execute:request", (msg: ExecuteRequest) => {
      log.debug("Got execute request from  client ", msg.code);
    });
  
  });
  */
  return httpServer;
}

