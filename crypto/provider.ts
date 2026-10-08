import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat, rename, rm, type FileHandle } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';


const ALGORITHM = 'aes-256-gcm';
const DIGEST = 'sha512';
const ITERATIONS = 210_000;
const KEY_LEN = 32;
const VERSION = 1;
const VERSION_LEN = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION_OFFSET = 0;
const SALT_OFFSET = VERSION_OFFSET + VERSION_LEN;
const IV_OFFSET = SALT_OFFSET + SALT_LEN;
const HEADER_LEN = IV_OFFSET + IV_LEN;
const MIN_FILE_SIZE = HEADER_LEN + TAG_LEN;
const LAST_BYTE = 1;

function deriveKey(masterkey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterkey, salt, ITERATIONS, KEY_LEN, DIGEST);
}

async function readAt(file: FileHandle, length: number, position: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  await file.read(buffer, { position });
  return buffer;
}

export async function encryptFile(inputFilename: string, outputFilename: string, masterkey: string, timeoutMs: number, callerSignal: AbortSignal) {

  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(masterkey, salt);
  const header = Buffer.concat([Buffer.from([VERSION]), salt, iv]);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LEN });

  cipher.setAAD(header);

  await pipeline(
    createReadStream(inputFilename),
    cipher,
    async function* (source) {
      yield header;                                     // header (version)
      for await (const chunk of source) yield chunk;    // content 
      yield cipher.getAuthTag();                        // auth tag      
    },
    createWriteStream(outputFilename),
    { signal: AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)]) }
  );
}

export async function decryptFile(src: string, dest: string, masterkey: string, timeoutMs: number, callerSignal: AbortSignal) {
  const { size } = await stat(src);
  if (size <= MIN_FILE_SIZE) throw new Error('Invalid encrypted file');

  const tagOffset = size - TAG_LEN;

  const fileHandle = await open(src, 'r');
  let header: Buffer;
  let tag: Buffer;
  try {
    header = await readAt(fileHandle, HEADER_LEN, VERSION_OFFSET);
    tag = await readAt(fileHandle, TAG_LEN, tagOffset);
  } finally {
    await fileHandle.close();
  }

  const version = header[VERSION_OFFSET];
  if (version !== VERSION) throw new Error(`Unsupported version: ${version}`);

  const salt = header.subarray(SALT_OFFSET, IV_OFFSET);
  const iv = header.subarray(IV_OFFSET, HEADER_LEN);

  const key = deriveKey(masterkey, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LEN });
  decipher.setAAD(header);
  decipher.setAuthTag(tag);

  const tmp = `${dest}.tmp`;
  try {
    await pipeline(
      createReadStream(src, { start: HEADER_LEN, end: tagOffset - LAST_BYTE }),
      decipher,
      createWriteStream(tmp),
      { signal: AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)]) }
    );
    await rename(tmp, dest); // seulement si l'authentification a réussi
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}


