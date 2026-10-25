

import { promisify } from 'node:util';
import child_process, { type ExecException } from 'node:child_process';
const exec = promisify(child_process.exec);
import { run } from "node:test"
import { join } from "path"

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

export async function getTestSummary(filename: string) {

  let summary;

  for await (const event of run({ files: [join(import.meta.dirname, filename)] })) {

    // && !event.data.file - means only get the overall summary (not the per-file one) 
    // as the event is emitted once per file then once for the overall summary
    if (event.type === 'test:summary' && !event.data.file) {
      summary = event.data;
    }
  }

  return summary;
}
