import dotenv from 'dotenv';
import createError, { HttpError } from "http-errors"
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import bunyan, { RotatingFileStream } from 'bunyan';
import { report } from "node:process";
import openApi from '@wesleytodd/openapi';
import favicon from "serve-favicon";
import helmet from "helmet"
import indexRouter from "./routes/index.ts"
import usersRouter from "./routes/users.ts"

import type { Express, Request, Response, NextFunction } from "express";
import type { LoggerOptions } from 'bunyan'

// read .env files and populate process.env
dotenv.config();

const loggerOptions: LoggerOptions = {
  name: "express-typescript-node",
  src: true,
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
// @example : log.debug("blabla")
// log = bunyan.createLogger(loggerOptions);
export const log = bunyan.createLogger(loggerOptions);

const ONE_YEAR = 1000 * 60 * 60 * 24 * 365;
const app: Express = express();

log.debug("[Application]: server started at " + new Date(Date.now()).toLocaleString("fr-FR"))

// view engine setup
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'jade');

// @ts-ignore
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(favicon(path.join(import.meta.dirname, "public", "favicon.ico")));

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

app.use('/', indexRouter);
app.use('/users', usersRouter);

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
