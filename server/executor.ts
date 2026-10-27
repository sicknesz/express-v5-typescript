import { promisify, styleText } from 'node:util';
import child_process from 'node:child_process';
import { run } from "node:test"

import type { ExecException } from 'node:child_process';
import type { Websocket } from "./websockets.ts"

const exec = promisify(child_process.exec);

type Status = "PASSED" | "FAILED" | "SKIPPED";
type TestSuccess = {
  status: Status,
  name: string,
  durationMs: number
};
type TestFailed = TestSuccess & { error: string };
export type TestResult = TestSuccess | TestSuccess | TestFailed;

const green = (msg: string) => styleText('green', msg);
const red = (msg: string) => styleText('red', msg);

// TODO: group in a file guards.ts 
function isExecException(e: ExecException | any): e is ExecException {
  return "code" in e;
}

// see : https://github.com/ErickWendel/recreating-nodejs-test-runner/blob/main/test-runner/bin/test-runner.js
export default async function runAsSeparateProcess(filename: string, signal: AbortSignal, permission?: string) {
  const timeoutMs = 5000;
  const command = permission ? `node --permission ${permission} ${filename}` : `node --permission ${filename}`;

  try {
    const { stderr, stdout } = await exec(command, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
    return {
      exitCode: 0,
      stderr: stderr,
      stdout: stdout
    }
  } catch (e) {
    console.error(e); // should contain code (exit code) and signal (that caused the termination).        
  }
}

export async function runIsolated(filename: string, signal: AbortSignal, permission?: string, timeoutMs: number = 5000) {

  const command = permission ? `node --permission ${permission} ${filename}` : `node --permission ${filename}`;

  try {
    const { stderr, stdout } = await exec(command, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
    return {
      exitCode: 0,
      stderr: stderr,
      stdout: stdout
    }
  } catch (e: unknown) {
    if (isExecException(e)) {
      return {
        exitCode: 0,
        stderr: "",
        stdout: ""
      }
    }
  }
}

export async function getTestSummary(websocket: Websocket, filename: string): Promise<TestResult[]> {

  const results: TestResult[] = []
  const files = [filename];
  for await (const event of run({ files })) {

    if (event.type === "test:start") {
      //websocket.emit("runner:test:start", { event });
    }

    if (event.type === "test:fail" && event.data.details.type === "test") {

      console.log(red("Failed") + (` : ${event.data.details.classname}/${event.data.name} - runtime: ${event.data.details.duration_ms}ms`));
      results.push({ status: "FAILED", name: event.data.name, error: event.data.details.error.message, durationMs: event.data.details.duration_ms });
      // websocket.emit("runner:test:fail", { event });
    }

    if (event.type === "test:pass" && event.data.details.type === "test") {
      console.log(green("Passed") + (` : ${event.data.details.classname}/${event.data.name} - runtime: ${event.data.details.duration_ms}ms`));
      results.push({ status: "PASSED", name: event.data.name, durationMs: event.data.details.duration_ms });
      //websocket.emit("runner:test:pass", { event });
    }

    if (event.type === "test:summary" && !event.data.file) {
      websocket.emit("runner:test:summary", { event });
    }
  }

  return results;
}


/*
const controller = new AbortController();
const { signal } = controller;

const result = await sandboxedExecution("test.ts", signal, "--allow-fs-read=input.txt");
console.log(result)
*/