import { Server as WebsocketServer } from "socket.io"
import fs from "fs/promises"
import { log } from "./app.ts"
import { createServer } from "node:http";
import type { Express } from "express"
import { AuthenticationError } from './errors.ts'
// import jwt from "jsonwebtoken" -- // TODO : use to auth websockets 

import { runIsolated } from './executor.ts';


type ExecutionRequest = { code: string, testCode: string, clientId: string };
type ExecutionResult = { stderr: string, stdout: string, exitCode: number };
type ExecutionError = { exitCode: number };

interface ServerToClientEvents {
  ['nodejs:execute:result']: ({ stderr, stdout, exitCode }: ExecutionResult) => void;
  ['nodejs:execute:error']: ({ exitCode }: ExecutionError) => void;
}
interface ClientToServerEvents {
  ['nodejs:execute:request']: ({ code, testCode, clientId }: ExecutionRequest) => void;
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

    // TODO : testing - probablyt add a try/catch 
    socket.on("nodejs:execute:request", async ({ code, testCode, clientId }) => {
      if (!socket.data.authenticated) {
        throw new AuthenticationError("[socket.io]: unauthorized to execute code as anonymous");
      }
      log.debug(`[Socket.io]: Got execute request from ${clientId}`, code, testCode);

      // write the file to disk for isolated execution (as it's own process with limited permissions)
      await fs.writeFile(getFilename(clientId), code, "utf-8");

      const abortController = new AbortController();

      const result = await runIsolated(clientId, abortController.signal, undefined, 10000);
      if (result?.exitCode === 0) {
        const { stderr, stdout, exitCode } = result
        socket.emit("nodejs:execute:result", { stderr, stdout, exitCode });
      }
      else if (result?.exitCode) {
        socket.emit("nodejs:execute:error", { exitCode: result.exitCode });
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

function getTestFilename(clientId: string) {
  return `${clientId}.test.ts`;
}