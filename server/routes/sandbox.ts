import express from 'express';
import vm from "node:vm"
const router = express.Router();
import { log } from "../app.ts"

import type { Request, Response, NextFunction } from "express";

/* GET users listing. */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('respond with a resource');
});

router.post('/execute', (req: Request, res: Response, next: NextFunction) => {
  const { sourceCode, timeoutMs } = req.body;

  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode: number = 0;

  const deadLine = Date.now() + timeoutMs;

  const logger = (...args: any[]) => {
    if (Date.now() > deadLine) {
      return;
    }
    console.log(...args);
  }

  const context = {
    // see if we need this 
    ...process,       // passing setTimeout, setImmediate, etc ... processNextTick to script 
    console: {
      log: logger,
      warn: logger,
      error: logger,
      info: logger
    }
  };

  log.debug(context, "[SANDBOX]: Created context for script ");

  const contextified = vm.createContext(context);

  log.debug(contextified, "[SANDBOX]: Created script sandbox from source code");
  const script = new vm.Script(sourceCode);

  log.debug(contextified, "[SANDBOX]: Running script inside sandbox");
  const lastStatement = script.runInContext(contextified, {
    timeout: timeoutMs
  })

  log.debug({ contextified, sourceCode }, "[SANDBOX]: Executed script, last statement returned : " + lastStatement)

  res.send('respond with a resource');
});

export default router;
