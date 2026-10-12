import fs from "node:fs/promises"
import path from "node:path"
import vm, { Script } from 'node:vm';

import type { Context, } from "node:vm"

const readFilePermission = 'fs.read';

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

    const logs : unknown[] = [];

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
    await new Promise((resolve, reject) => setTimeout(resolve, timeoutMs))

    return logs;
}