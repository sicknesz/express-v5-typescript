import createError, { HttpError } from "http-errors"
import express from 'express';
import path from 'path';
import cors from "cors";
import cookieParser from 'cookie-parser';
import session from "express-session";
import logger from 'morgan';
import bunyan from 'bunyan';
import { report } from "node:process";
import fs from "node:fs/promises"
import mongoose from "mongoose";
import bodyParser from "body-parser"
import dotenv from "dotenv"
import favicon from "serve-favicon";
import helmet from "helmet"
import { apiReference } from '@scalar/express-api-reference'
import i18n from "i18n";
// Local imports
import indexRouter from "./routes/index.ts"
import sandboxRouter from "./routes/sandbox.ts"
import authRouter from "./routes/auth.ts"
import createCRUDController from "./controllers/createCrudController.ts"
import { initWebsocket } from "./websockets.ts";
import { initPassport } from "./strategy/auth.ts"
import { connect } from "./database.ts"
import { displayRouterLayer } from "./utils/utils.ts"

// Types import
import type { Express, Request, Response, NextFunction } from "express";

// Types definition
type MiddleWare = (req: Request, res: Response, next: NextFunction) => void;

dotenv.config()

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
 * @brief middleware for debug/testing
 * @param req {Request}
 * @param res {Response}
 * @param next {NextFunction}
 */
const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  log.debug(`Got ${req.url} - ${new Date(Date.now()).toLocaleDateString("fr-FR")}`);
  next();
}

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3001');

/**
 * Initialize websocket streams/events handlers 
 */
const server = initWebsocket(app);
if (!server) {
  throw new Error("Websocket not initialized")
}

server.listen(port, async () => {
  log.debug(`listening on port ${port}`);
  const client = await connect(app);
  log.debug(`Connected to database ${client.connection.host} ${client.connection.name}`);
});


app.use(i18n.init)
app.set('port', port);

log.debug("server started at " + new Date(Date.now()).toLocaleString("fr-FR"))

app.use(express.json({ limit: "500mb" }));
app.use(bodyParser.json());

// TODO : fix cookie/session/token mismatch/mixup
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || "sercet",
  resave: true,
  saveUninitialized: true
}));

// view engine setup
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));


app.use(express.urlencoded({ extended: false }));
app.use(favicon(path.join(import.meta.dirname, "public", "favicon.ico")));
app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.set("trust proxy", 1); // use this if behing a reverse proxy in production
app.use(helmet.hsts({
  maxAge: ONE_YEAR,
  includeSubDomains: true
}));
app.use(helmet.xPoweredBy());

app.use(helmet.noSniff());

app.use(express.urlencoded({
  limit: "500mb",
  extended: true
}));

const passport = initPassport()
if (!passport) {
  throw new Error("Passport not initialized")
};

app.use(passport.initialize());
app.use(passport.session());


// TODO : complete OpenApi definition
// const oapi = openApi({
//   openapi: '3.0.0',
//   info: {
//     title: 'Express Typescript Application',
//     description: 'Generated docs from an Express api',
//     version: '1.0.0',
//   }
// })
// OpenAPI 
// app.use('/docs', oapi.swaggerui())

app.use(
  '/docs',
  apiReference({
    // Put your OpenAPI url here:
    theme: 'purple',
    url: '/openapi.json'
  }),
)

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

// app.options('*', cors());

/**
 * Load unprotected routes
 */
app.use('/', indexRouter);
app.use("/auth", authRouter);

// Clean prefix match (No wildcards needed!)
app.use("/api", passport.authenticate("jwt", { session: false }));
app.use('/api/sandbox', sandboxRouter);


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



async function getModels(...middlewares: MiddleWare[]) {
  const modelFolder = path.join(import.meta.dirname, "models");
  const entries = await fs.readdir(modelFolder, { withFileTypes: true, recursive: true });
  const files = entries.filter(e => e.isFile());

  for await (const file of files) {
    const module = await import(path.join(file.parentPath, file.name));
    const modelName = file.name.slice(0, -3);
    log.debug("Loading model : " + modelName + " and mounting CRUD router.");

    // this is needed but we don't need the returned value
    mongoose.model(modelName, module.default);
    const controller = createCRUDController(modelName);

    const {
      create: {
        path: createPath,
        handler: createHandler
      },
      read: {
        path: readPath,
        handler: readHandler
      },
      readAll: {
        path: readAllPath,
        handler: readAllHandler
      },
      delete: {
        path: deletePath,
        handler: deleteHandler
      },
      update: {
        path: updatePath,
        handler: updateHandler
      }
    } = controller;

    app.post(createPath, ...middlewares, createHandler);
    app.get(readPath, ...middlewares, readHandler);
    app.get(readAllPath, ...middlewares, readAllHandler);
    app.delete(deletePath, ...middlewares, deleteHandler);
    app.put(updatePath, ...middlewares, updateHandler);
  }

  displayRouterLayer(app.router.stack)
}



if (typeof process.env.MAX_STACK_TRACE !== "undefined" && isNumber(parseInt(process.env.MAX_STACK_TRACE))) {
  Error.stackTraceLimit = parseInt(process.env.MAX_STACK_TRACE, 10) || 50;
  report.reportOnUncaughtException = Boolean(process.env.REPORT_CRASH) || false;
}

if (report.reportOnUncaughtException) {

  // Handle unhandled promise rejection 
  process.on("unhandledRejection", (reason: unknown) => {
    log.error("Unhandled Rejection : " + reason);
  });

  // Catch : uncaught exception callback
  process.setUncaughtExceptionCaptureCallback((err: unknown) => {
    if (err instanceof Error) {
      log.error(`Capture Uncaught Exception : ${err.message}, Writing nodeJS report to disk, send an email to developpers`);
    }
  });
}


// set signal handlers
process.on("SIGTERM", () => {
  log.warn("Got SIGTERM");
});


export default app;

