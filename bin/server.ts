#!/usr/bin/env node

/**
 * Module dependencies.
 */
import type { HttpError } from 'http-errors';
import app, { log } from '../app.ts';
import http from 'http';

log.debug('express:server');

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

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


}
