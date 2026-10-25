import { promisify } from 'node:util';
import child_process, { type ExecException } from 'node:child_process';
const exec = promisify(child_process.exec);
import { run } from "node:test"
import { join } from "path"

/*
    '      at Test.start (node:internal/test_runner/test:1262:17)\n' +
    '      at Test.run (node:internal/test_runner/test:1402:25)\n' +
    '      at Test.runInAsyncScope (node:async_hooks:227:14)\n' +  
*/

export default async function sandboxedExecution(filename: string, signal: AbortSignal, permission?: string) {

  const timeoutMs = 5000;


  const command = permission ? `node --permission ${permission} ${filename}` : `node --permission ${filename}`;

  try {
    const { stderr, stdout } = await exec(command, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);

    return {
      exitCode: 0,
      stderr: stderr,
      stdout: stdout
    }

  } catch (e) {
    console.error(e); // should contain code (exit code) and signal (that caused the termination).        
  }
}



function isExecException(e: ExecException | any): e is ExecException {
  return "code" in e;
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

type Status = "PASSED" | "FAILED" | "SKIPPED";

type TestSkip = { status: Status, name: string, durationMs: number };
type TestSuccess = { status: Status, name: string, durationMs: number };
type TestFailed = { status: Status, name: string, error: string, durationMs: number };
type TestResult = TestSkip | TestSuccess | TestFailed;
// type TestSummary = { pass: number, fail: number, skip: number, errors: FailedTestError[] };

export async function getTestSummary(filename: string): Promise<TestResult[]> {

  const counts: TestResult[] = []

  for await (const event of run({ files: [join(import.meta.dirname, filename)] })) {

    if (event.type === "test:fail" && event.data.details.type === "test") {
      console.log(`Failed : ${event.data.details.classname}/${event.data.name} - runtime: ${event.data.details.duration_ms}ms`);
      counts.push({ status: "FAILED", name: event.data.name, error: event.data.details.error.message, durationMs: event.data.details.duration_ms });
    }

    if (event.type === "test:pass" && event.data.details.type === "test") {
      console.log(`Passed : ${event.data.details.classname}/${event.data.name} - runtime: ${event.data.details.duration_ms}ms`)
      counts.push({ status: "PASSED", name: event.data.name, durationMs: event.data.details.duration_ms });
    }

    if (event.type === "test:skip" && event.data.details.type === "test") {
      console.log(`Passed : ${event.data.details.classname}/${event.data.name} - runtime: ${event.data.details.duration_ms}ms`)
      counts.push({ status: "PASSED", name: event.data.name, durationMs: event.data.details.duration_ms });
    }    

  }

  return counts;
}


const summary = await getTestSummary("test.ts")
console.log(summary)

/*
const controller = new AbortController();
const { signal } = controller;

const result = await sandboxedExecution("test.ts", signal, "--allow-fs-read=input.txt");
console.log(result)
*/