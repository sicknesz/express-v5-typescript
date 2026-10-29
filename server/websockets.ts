import { Server as WebsocketServer } from "socket.io"
import fs from "fs/promises"
import { log } from "./app.ts"
import { createServer } from "node:http";
import type { Express } from "express"
import { AuthenticationError } from './errors.ts'
import { getTestSummary } from './executor.ts';
import type { TestResult } from './executor.ts';
import path from "node:path";
// import jwt from "jsonwebtoken" -- // TODO : use to auth websockets 
import type { Socket } from "socket.io"


type ExecutionRequest = { code: string, testCode: string, clientId: string };
type ExecutionError = { error: unknown };

interface ServerToClientEvents {
  ['runner:result']: ({ result }: { result: TestResult[] }) => void;
  ['runner:error']: ({ error }: ExecutionError) => void;
  ['runner:test:summary']: ({ event }: { event: any }) => void;
  // ['runner:test:fail']: ({ event }: { event: any }) => void;
  // ['runner:test:pass']: ({ event }: { event: any }) => void;
}
interface ClientToServerEvents {
  ['runner:request']: ({ code, testCode, clientId }: ExecutionRequest) => void;
}

interface SocketData {
  authenticated: boolean;
}

export type Websocket = Socket<ClientToServerEvents, ServerToClientEvents, SocketData>;

export function initWebsocket(app: Express) {

  const httpServer = createServer(app);

  const io = new WebsocketServer<ClientToServerEvents, ServerToClientEvents, SocketData>(httpServer);

  io.on("connection", (socket) => {
    log.debug(`[Socket.io]: client : ${socket.id}`);

    socket.conn.once("upgrade", (transport) => {
      log.debug(`[Socket.io]: transport upgraded to ${transport.name}`);
    });


    socket.on("disconnect", (reason) => {
      log.debug(`[Socket.io]: disconnected due to ${reason}`);
    });

    // eslint-disable-next-line
    socket.on("runner:request", async ({ code, testCode, clientId }) => {
      if (!socket.data.authenticated) {
        throw new AuthenticationError("[socket.io]: unauthorized to execute code as anonymous");
      }

      const filename = getTestFilename(clientId);
      const fullPath = path.join(import.meta.dirname, "public", "uploads", filename);
      log.debug(`[Socket.io]: Got execute request from ${clientId} - send file : ${filename}`);

      try {

        // write the file to disk for isolated execution (as it's own process with limited permissions)        
        await fs.writeFile(fullPath, code, "utf-8");

        const result: TestResult[] = await getTestSummary(socket, fullPath);
        socket.emit("runner:result", { result });
      }
      catch (err: unknown) {
        if (err instanceof Error) {
          socket.emit("runner:error", { error: err });
        }
      }
      finally {
        fs.unlink(fullPath);
      }
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

  return httpServer;
}


function getFilename(clientId: string) {
  return `${clientId}.ts`;
}

// eslint-disable-next-line
function getTestFilename(clientId: string) {
  return `${clientId}.test.ts`;
}