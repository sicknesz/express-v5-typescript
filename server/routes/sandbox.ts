import express from 'express';
import vm from "node:vm"
import { log } from "../app.ts"
import { ForbiddenError, Ability } from "@casl/ability";
import { getAbilityFor, type AppAbilities } from "../ability/abilities.ts";

import type { AnyAbility } from "@casl/ability";
import type { Request, Response } from "express";
import type { AccountAttributes } from '../models/Account.ts';
import { Exercise } from "../models/Exercise.ts"
import type { ExerciseAttributes } from "../models/Exercise.ts"

const router = express.Router();

declare global {
  namespace Express {
    interface Request {
      ability?: Ability<AppAbilities>;
      PermissionError: ForbiddenError<AnyAbility>;
    }
  }
}

const EXERCISE_KEYS = [
  "name",
  "timeoutMs",
  "codeSnippets",
  "requirements",
  "goal",
  "score",
  "testSnippets",
] as const satisfies readonly (keyof ExerciseAttributes)[];

const ACCOUNT_KEYS = [
  'role',
  'authorization',
  'email'
] as const satisfies readonly (keyof AccountAttributes)[];

function isExercise(doc: unknown): doc is ExerciseAttributes {
  return typeof doc === "object" && doc !== null && EXERCISE_KEYS.every((k) => k in doc);
}

function isAccount(user: Express.User | AccountAttributes): user is AccountAttributes {
  return ACCOUNT_KEYS.every((k) => k in user);
}

// load abilities for each request reaching this router
router.use((req: Request, _, next) => {
  log.debug(req.user, "Loading abilities for ");
  if (req.user && isAccount(req.user)) {
    req.ability = getAbilityFor(req.user);
    log.debug(req.ability, "Loading abilities for ");
    req.PermissionError = ForbiddenError.from(req.ability);
  }
  log.debug(req.ability, "passing request to next middleware...");
  next();
});

router.get('/', async (req: Request, res: Response) => {
  const exercises = await Exercise.find({});
  // req.PermissionError.throwUnlessCan("read", 'exercise');
  return res.json({ success: true, exercises: exercises });
});

router.get('/:id', async (req: Request, res: Response) => {
  const exercise = await Exercise.findOne({ _id: '123' });
  // req.PermissionError.throwUnlessCan("read", exercise);
  return res.json({ success: true, exercise: exercise });
});

router.post('/execute/', async (req: Request, res: Response) => {

  const { PermissionError } = req;
  PermissionError.throwUnlessCan(["create", "execute"], "exercise");

  const { sourceCode, timeoutMs } = req.body;

  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode: number = 0;

  const deadLine = Date.now() + timeoutMs;

  const logger = (...args: any[]) => {
    if (Date.now() > deadLine) {
      return;
    }
    console.log("[SANDBOX]:", ...args);
    stdout.push(...args);
  }

  const context = {
    ...process,       // passing setTimeout, setImmediate, etc ... processNextTick to script 
    console: {
      log: logger,
      warn: logger,
      error: logger,
      info: logger
    }
  };

  log.debug("[SANDBOX]: Created context for script ");

  const contextified = vm.createContext(context);

  log.debug("[SANDBOX]: Created script sandbox from source code");
  const script = new vm.Script(sourceCode);

  log.debug("[SANDBOX]: Running script inside sandbox");
  try {
    const lastStatement = script.runInContext(contextified, {
      timeout: timeoutMs
    })

    log.debug(sourceCode, "[SANDBOX]: Executed script, last statement returned : " + lastStatement)

    return res.json({ success: true, stdout, stderr, exitCode });
  }
  catch (err: any) {
    if (err instanceof Error) {
      return res.json({ success: false, error: err });
    }
    return res.json({ success: false, error: new Error(err) });
  }

});

router.get('/execute/:id', async (req: Request, res: Response) => {

  const exercise = await Exercise.findById({ _id: req.params.id }).lean();

  if (!exercise) {
    return;
  }

  const { PermissionError } = req;
  PermissionError.throwUnlessCan("execute", exercise);

  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode: number = 0;

  const deadLine = Date.now() + 5000;

  const logger = (...args: any[]) => {
    if (Date.now() > deadLine) {
      return;
    }
    console.log("[SANDBOX]:", ...args);
    stdout.push(...args);
  }

  const context = {
    ...process,       // passing setTimeout, setImmediate, etc ... processNextTick to script 
    console: {
      log: logger,
      warn: logger,
      error: logger,
      info: logger
    }
  };

  log.debug("[SANDBOX]: Created context for script ");

  if (!isExercise(exercise as ExerciseAttributes)) {
    return;
  }

  try {
    log.debug("[SANDBOX]: Created context for sandbox");
    const contextified = vm.createContext(context);
    const script = new vm.Script(exercise.codeSnippets);
    log.debug("[SANDBOX]: Running script inside sandbox");
    const lastStatement = script.runInContext(contextified, { timeout: exercise.timeoutMs })
    log.debug(exercise.name, "[SANDBOX]: Executed script, last statement returned : " + lastStatement)
    return res.json({ success: true, stdout, stderr, exitCode });
  }
  catch (err: any) {
    if (err instanceof Error) {
      return res.json({ success: false, error: err });
    }
    return res.json({ success: false, error: new Error(err) });
  }

});


export default router;
