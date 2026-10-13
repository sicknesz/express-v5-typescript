import fs from "node:fs/promises"
import path from "node:path"
import vm, { Script } from 'node:vm';

import { pipeline } from "node:stream";
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";

import type { Context, } from "node:vm"
import jwt from "jsonwebtoken"

import type { IAccountDocument } from "../models/Account.ts"

const readFilePermission = 'fs.read';

export async function generateToken(payload: object, expiresIn: jwt.SignOptions['expiresIn'] = "7d") {
  const token = jwt.sign(payload, (process.env.JWT_SECRET || "secret") as string, { expiresIn } as jwt.SignOptions);
  return token;
}

export function getCleanUser(user: IAccountDocument) {
  const u = user.toJSON();

  const {
    salt,
    hash,
    password,
    active,
    resetPasswordToken,
    resetPasswordExpiration,
    ...cleanUser
  } = u;

  return cleanUser;
}

/**
 * @note needs node to be started with --permission 
 * @param parentFolderPath 
 * @param filename 
 * @returns 
 */
export async function readThenProtect(parentFolderPath: string, filename: string) {

  if (!process.permission) {
    return { success: false, reason: "permission policies not enabled" }
  }

  const canRead = process.permission.has(readFilePermission, filename);
  if (!canRead) {
    return { success: false, reason: ("process has no permission to read " + filename) }
  }

  const filePath = path.join(parentFolderPath, filename);

  const content = await fs.readFile(filePath, 'utf8');

  process.permission.drop(readFilePermission, parentFolderPath);

  return { success: true, content }
}


export async function virtualizeSource(sourceCode: string, context: Context, timeoutMs: number) {

  const deadline = Date.now() + timeoutMs;

  const logs: unknown[] = [];

  const recordConsole = (...args: unknown[]) => {
    if (Date.now() > deadline) return;
    console.log(...args);
    logs.push(...args);
  }

  const contextified = vm.createContext({
    ...context,
    console: {
      log: recordConsole,
      warn: recordConsole,
      error: recordConsole,
      infor: recordConsole
    },
    setImmediate: setImmediate,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearImmediate: clearImmediate,
    clearTimeout: clearTimeout,
  });
  const script = new Script(sourceCode);

  // Gotcha point : timeout only applies to synchronous tasks 
  script.runInContext(contextified, {
    timeout: timeoutMs
  })

  // wait until timeout is reached
  await new Promise((resolve) => setTimeout(resolve, timeoutMs))

  return logs;
}


export async function compressFile(inputFilename: string, outputFilename: string, useCompression: boolean = true) {

  if (useCompression) {
    return pipeline(
      createReadStream(inputFilename),
      createGzip(),
      createWriteStream(outputFilename + ".gz"), (err) => {
        if (err) {
          console.error("Pipeline failed", err);
        } else {
          console.log("Pipeline succeeded");
        }
      }
    );
  }

  return pipeline(
    createReadStream(inputFilename),
    createWriteStream(outputFilename), (err) => {
      if (err) {
        console.error("Pipeline failed", err);
      } else {
        console.log("Pipeline succeeded");
      }
    }
  );
}


/*
export type Failure<E = unknown> = {
  _tag: "Failure";
  error: E;
};

export type Success<T = void> = {
  _tag: "Success";
  data: T;
};

export type Result<T = void, E = unknown> = Failure<E> | Success<T>;

export function succeed<T = void>(data: T): Success<T> {
  return {
    _tag: "Success",
    data: data,
  };
}

export function fail<E = unknown>(error: E): Failure<E> {
  return {
    _tag: "Failure",
    error: error,
  };
}

const success = succeed("Hello, world!"); // Success<string>
const failure = fail("Something went wrong"); // Failure<string>


type PromiseResult<T, E = Error> = { error: E, data: T };

export function runAsync<T>(task: T): Promise<T> {
  task()
    .then(r => {
      return { error: null, data: result }
    })
    .catch((err: Error) => ({ error: err, data: null }))
}
*/