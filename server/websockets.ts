import { Server as WebsocketServer } from "socket.io"
import fs from "fs/promises"
import { log } from "./app.ts"
import { createServer } from "node:http";
import type { Express } from "express"
import { AuthenticationError } from './errors.ts'
import { runIsolated } from './executor.ts';
// import jwt from "jsonwebtoken" -- // TODO : use to auth websockets 

type ExecutionRequest = { code: string, testCode: string, clientId: string };
type ExecutionResult = { stderr: string, stdout: string, exitCode: number };
type ExecutionError = { exitCode: number };

interface ServerToClientEvents {
  ['runner:result']: ({ stderr, stdout, exitCode }: ExecutionResult) => void;
  ['runner:error']: ({ exitCode }: ExecutionError) => void;
}
interface ClientToServerEvents {
  ['runner:request']: ({ code, testCode, clientId }: ExecutionRequest) => void;
}

interface SocketData {
  authenticated: boolean;
}


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

      const filename = getFilename(clientId);
      log.debug(`[Socket.io]: Got execute request from ${clientId} - send file : ${filename}`);

      // write the file to disk for isolated execution (as it's own process with limited permissions)
      await fs.writeFile(filename, code, "utf-8");

      const abortController = new AbortController();

      const result = await runIsolated(filename, abortController.signal, undefined, 10000);
      if (result?.exitCode === 0) {
        const { stderr, stdout, exitCode } = result
        socket.emit("runner:result", { stderr, stdout, exitCode });
      }
      else if (result?.exitCode) {
        socket.emit("runner:error", { exitCode: result.exitCode });
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