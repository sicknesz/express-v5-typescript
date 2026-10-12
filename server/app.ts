import createError, { HttpError } from "http-errors"
import express from 'express';
import path from 'path';
import cors from "cors";
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import bunyan, { RotatingFileStream } from 'bunyan';
import { report } from "node:process";
import fs from "node:fs/promises"
import mongoose from "mongoose";
import debugPackage from "debug";

// @ts-ignore
import openApi from '@wesleytodd/openapi';
import favicon from "serve-favicon";
import helmet from "helmet"
import { Server } from 'socket.io';

// Local imports
import indexRouter from "./routes/index.ts"
import usersRouter from "./routes/sandbox.ts"
import initWebsocket from "./websockets.ts";
import createCRUDController from "./controllers/createCrudController.ts"

import type { Express, Request, Response, NextFunction } from "express";

type MiddleWare = (req: Request, res: Response, next: NextFunction) => void;

debugPackage("Express app");

const loggerOptions: bunyan.LoggerOptions = {
  name: "express-typescript-node",
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [
    {
      name: "console",
      level: "trace",
      stream: process.stdout,
    },
    {
      type: 'rotating-file',
      path: './logs/express-typescript-node.log',
      period: '30d', // Rotate monthly
      count: 12     // Keep 12 back copies
    },
  ],
}

// Global logging facility 
export const log = bunyan.createLogger(loggerOptions);

const ONE_YEAR = 1000 * 60 * 60 * 24 * 365;
const app: Express = express();

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const server = app.listen(port);
server.on('error', onError);
server.on('listening', onListening);


const io = initWebsocket(server);
app.set("socket.io", io);


log.debug("[Application]: server started at " + new Date(Date.now()).toLocaleString("fr-FR"))

// view engine setup
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'jade');

// @ts-ignore
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(favicon(path.join(import.meta.dirname, "public", "favicon.ico")));

// app.options('*', cors()); // include before other routes
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// use this if behing a reverse proxy in production
app.set("trust proxy", 1); // trust first proxy


app.use(
  // protect encryption using hsts
  helmet.hsts({
    maxAge: ONE_YEAR,
    includeSubDomains: true
  }),
);
app.use(helmet.hidePoweredBy());

// allow big files 
app.use(
  express.urlencoded({
    limit: "500mb",
    extended: true
  }),
);

// TODO : complete OpenApi definition
const oapi = openApi({
  openapi: '3.0.0',
  info: {
    title: 'Express Typescript Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  }
})

// OpenAPI 
app.use('/swaggerui', oapi.swaggerui())

// @ts-ignore
app.use(cookieParser());
app.use(express.static(path.join(import.meta.dirname, 'public')));

// TODO : IMPORTANT - do not forget to set origin 
app.all("/*splat", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.ORIGIN ? process.env.ORIGIN : "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-type, Accept, X-Access-Token, X-Key, Data-Type, Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
  } else {
    next();
  }
});

const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  log.debug(`Got ${req.url} - ${new Date(Date.now()).toLocaleDateString("fr-FR")}`);
  next();
}


app.use('/', indexRouter);
app.use('/users', usersRouter);


await getModels(loggerMiddleware);

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// error handler
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


function reportCrash() {
  const reportString = JSON.stringify(report.getReport(), null, 2);
  report.writeReport();
  log.error(reportString);

  // better let an application crash and restart that maintain execution and get unexpected behaviors
  process.exit(-1);
}

// set exception handler
function isNumber(value: number): value is number {
  return Number.isInteger(value);
}

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

async function getModels(...middlewares : MiddleWare[]) {
  const modelFolder = path.join(import.meta.dirname, "models");
  const entries = await fs.readdir(modelFolder, { withFileTypes: true, recursive: true });
  const files = entries.filter(e => e.isFile());
  
  for await (const file of files) {
    const module = await import(path.join(file.parentPath, file.name));
    const modelName = file.name.slice(0, -3);
    log.debug("Importing : " + modelName);
    
    const model = mongoose.model(modelName, module.default);
    const controller = createCRUDController(modelName);
    const endpoint = `/api/${modelName}`

    app.post(controller.create.path, ...middlewares, controller.create.handler);
    app.get(controller.read.path, ...middlewares, controller.read.handler);
    app.get(controller.readAll.path, ...middlewares, controller.readAll.handler);
    app.delete(controller.delete.path, ...middlewares, controller.delete.handler);
    app.put(controller.update.path, ...middlewares, controller.update.handler);

  }

  displayRouterLayer(app.router.stack)
}




function logMethod(methods) {
  const { get, post, delete: remove, put } = methods;

  if (get) return "GET";
  if (post) return "POST";
  if (put) return "PUT";
  if (remove) return "DELETE";

}

function displayRouterLayer(layers) {
  for (const layer of layers) {
    const { route: { methods, path, stack } = {} } = layer
    if (!methods) continue;
    console.log(`${logMethod(methods)} ${path}`);
  }
}



if (typeof process.env.MAX_STACK_TRACE !== "undefined" && isNumber(parseInt(process.env.MAX_STACK_TRACE))) {
  Error.stackTraceLimit = parseInt(process.env.MAX_STACK_TRACE) || 50;
  report.reportOnUncaughtException = !!process.env.REPORT_CRASH || false;
}

if (report.reportOnUncaughtException) {

  // Handle unhandled promise rejection 
  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    log.error("Unhandled Rejection : " + reason);
  });

  // Catch : uncaught exception callback
  process.setUncaughtExceptionCaptureCallback((err: unknown) => {
    if (err instanceof Error) {
      log.error(`[Application]: Capture Uncaught Exception : ${err.message}, Writing nodeJS report to disk, send an email to developpers`);
    }
  });
}


// set signal handlers
process.on("SIGTERM", () => {
  log.warn("[Application]: Got SIGTERM");
});
/*
process.on("SIGINT", () => {
  log.warn("[Application]: Got SIGINT");
});
*/
// process.on("SIGKILL", () => {
//   log.warn("[Application]: Got SIGKILL");
// });



export default app;

