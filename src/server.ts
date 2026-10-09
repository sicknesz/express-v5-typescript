#!/usr/bin/env node

/**
 * Module dependencies.
 */
import type { HttpError } from 'http-errors';
import app, { log } from './app.ts';
import http from 'http';
import { Server } from 'socket.io';


/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

interface ClientToServerEvents {
  greeting: (arg: string) => void;
}

/**
 * Create socket.io server.
 */
const io = new Server(server, { path: "/sockets", transports: ["websocket"] });

io.on("connection", (socket) => {
  socket.conn.on("upgrade", (transport) => {
    log.debug(`[Socket.io]: transport upgraded to ${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    log.debug(`[Socket.io]: disconnected due to ${reason}`);
  });

  socket.emit("greeting", "hello from server")
})

// websocket client connection auth handle
io.use((socket, next) => {

  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // socket.user = decoded; // Attach user info to the socket object
    // log.debug(decoded, "[Socket.io][jwt]: socket.io client authed");
    // next();
  } catch (error) {
    socket.emit("disconnect");
    return next(new Error('Authentication error: Invalid token'));
  }    


  socket.on("connect_error", (err) => {
    // { name: 'TRANSPORT_MISMATCH', transport: 'websocket', previousTransport: 'polling' }
    log.error("[Socket.io][ERROR]: ", err.code, err.message, err.context);
  });
});

/**
 * make socket.io accessible throughout the whole application - req.app.get("socket.io") is inside an handler
 */
app.set("socket.io", io);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(endpoint: string) {
  const port = parseInt(endpoint, 10);

  if (isNaN(port)) {
    // named pipe
    return endpoint;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: HttpError) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function notNull(addr: unknown): addr is null {
  return addr !== null;
}

function onListening() {
  const addr = server.address();

  if (notNull(addr)) {
    const bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;
    log.info('Listening on ' + bind);
  }
  else console.log("Listening ...")
}
