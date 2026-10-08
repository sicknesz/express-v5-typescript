import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptFile, decryptFile } from '../../crypto/provider.ts';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Tests for crypto/provider.ts
 *
 * These are integration-style tests that exercise the full
 * encrypt → decrypt round-trip using real file I/O and Node's
 * crypto primitives.
 *
 * A temporary directory is created for each test run and cleaned up afterwards.
 */
const TMP_DIR = path.join(import.meta.dirname, '.tmp-crypto-test');
const MASTER_KEY = 'super-secret-test-key-do-not-use-in-prod';
const TIMEOUT_MS = 25_000;

describe('crypto/provider', () => {
  beforeAll(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('encryptFile', () => {
    it('should create an encrypted output file', async () => {
      const input = path.join(TMP_DIR, 'plain.txt');
      const output = path.join(TMP_DIR, 'encrypted.bin');
      await writeFile(input, 'hello world');

      const ac = new AbortController();
      await encryptFile(input, output, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const encrypted = await readFile(output);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce output different from the plaintext', async () => {
      const plaintext = 'this is sensitive data';
      const input = path.join(TMP_DIR, 'plain2.txt');
      const output = path.join(TMP_DIR, 'encrypted2.bin');
      await writeFile(input, plaintext);

      const ac = new AbortController();
      await encryptFile(input, output, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const encrypted = await readFile(output);
      expect(encrypted.toString()).not.toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random salt/IV)', async () => {
      const input = path.join(TMP_DIR, 'plain3.txt');
      const out1 = path.join(TMP_DIR, 'enc3a.bin');
      const out2 = path.join(TMP_DIR, 'enc3b.bin');
      await writeFile(input, 'identical content');

      const ac = new AbortController();
      await encryptFile(input, out1, MASTER_KEY, TIMEOUT_MS, ac.signal);
      await encryptFile(input, out2, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const buf1 = await readFile(out1);
      const buf2 = await readFile(out2);
      expect(buf1.equals(buf2)).toBe(false);
    });

    it('should embed the version byte as the first byte of the output', async () => {
      const input = path.join(TMP_DIR, 'plain4.txt');
      const output = path.join(TMP_DIR, 'enc4.bin');
      await writeFile(input, 'version check');

      const ac = new AbortController();
      await encryptFile(input, output, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const buf = await readFile(output);
      expect(buf[0]).toBe(1); // VERSION = 1
    });
  });

  describe('decryptFile', () => {
    it('should round-trip: encrypt then decrypt returns the original content', async () => {
      const plaintext = 'round-trip test content 🎉';
      const input = path.join(TMP_DIR, 'rt_plain.txt');
      const encrypted = path.join(TMP_DIR, 'rt_enc.bin');
      const decrypted = path.join(TMP_DIR, 'rt_dec.txt');
      await writeFile(input, plaintext);

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);
      await decryptFile(encrypted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const result = await readFile(decrypted, 'utf-8');
      expect(result).toBe(plaintext);
    });

    it('should round-trip with binary data', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x80, 0x7f]);
      const input = path.join(TMP_DIR, 'rt_bin_plain.dat');
      const encrypted = path.join(TMP_DIR, 'rt_bin_enc.bin');
      const decrypted = path.join(TMP_DIR, 'rt_bin_dec.dat');
      await writeFile(input, binaryData);

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);
      await decryptFile(encrypted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      const result = await readFile(decrypted);
      expect(result.equals(binaryData)).toBe(true);
    });

    it('should reject an encrypted empty file (size equals MIN_FILE_SIZE, no ciphertext body)', async () => {
      const input = path.join(TMP_DIR, 'rt_empty.txt');
      const encrypted = path.join(TMP_DIR, 'rt_empty_enc.bin');
      const decrypted = path.join(TMP_DIR, 'rt_empty_dec.txt');
      await writeFile(input, '');

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      // Encrypted empty file is exactly HEADER_LEN + TAG_LEN = MIN_FILE_SIZE.
      // The provider uses `size <= MIN_FILE_SIZE` which rejects it.
      await expect(
        decryptFile(encrypted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal)
      ).rejects.toThrow('Invalid encrypted file');
    });

    it('should fail with the wrong key', async () => {
      const input = path.join(TMP_DIR, 'wrongkey_plain.txt');
      const encrypted = path.join(TMP_DIR, 'wrongkey_enc.bin');
      const decrypted = path.join(TMP_DIR, 'wrongkey_dec.txt');
      await writeFile(input, 'secret data');

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      await expect(
        decryptFile(encrypted, decrypted, 'wrong-key', TIMEOUT_MS, ac.signal)
      ).rejects.toThrow();
    });

    it('should fail on a truncated/corrupted file', async () => {
      const corrupted = path.join(TMP_DIR, 'corrupted.bin');
      const decrypted = path.join(TMP_DIR, 'corrupted_dec.txt');
      // Write a file smaller than MIN_FILE_SIZE (45 bytes)
      await writeFile(corrupted, Buffer.alloc(10));

      const ac = new AbortController();
      await expect(
        decryptFile(corrupted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal)
      ).rejects.toThrow('Invalid encrypted file');
    });

    it('should fail when the version byte is unsupported', async () => {
      const input = path.join(TMP_DIR, 'badversion_plain.txt');
      const encrypted = path.join(TMP_DIR, 'badversion_enc.bin');
      const decrypted = path.join(TMP_DIR, 'badversion_dec.txt');
      await writeFile(input, 'test');

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      // Corrupt the version byte
      const buf = await readFile(encrypted);
      buf[0] = 99; // unsupported version
      await writeFile(encrypted, buf);

      await expect(
        decryptFile(encrypted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal)
      ).rejects.toThrow('Unsupported version: 99');
    });

    it('should clean up the .tmp file on decryption failure', async () => {
      const input = path.join(TMP_DIR, 'cleanup_plain.txt');
      const encrypted = path.join(TMP_DIR, 'cleanup_enc.bin');
      const decrypted = path.join(TMP_DIR, 'cleanup_dec.txt');
      await writeFile(input, 'cleanup test');

      const ac = new AbortController();
      await encryptFile(input, encrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);

      // Tamper with the ciphertext (not the header or tag — the body)
      const buf = await readFile(encrypted);
      const bodyStart = 29; // HEADER_LEN = 29
      if (buf.length > bodyStart + 5) {
        buf[bodyStart] ^= 0xff;
        buf[bodyStart + 1] ^= 0xff;
        await writeFile(encrypted, buf);
      }

      try {
        await decryptFile(encrypted, decrypted, MASTER_KEY, TIMEOUT_MS, ac.signal);
      } catch {
        // Expected to fail
      }

      // The .tmp file should have been cleaned up
      const { access } = await import('node:fs/promises');
      await expect(access(decrypted + '.tmp')).rejects.toThrow();
    });
  });

  describe('encryptFile with abort', () => {
    it('should respect an already-aborted signal', async () => {
      const input = path.join(TMP_DIR, 'abort_plain.txt');
      const output = path.join(TMP_DIR, 'abort_enc.bin');
      await writeFile(input, 'abort test');

      const ac = new AbortController();
      ac.abort(); // abort immediately

      await expect(
        encryptFile(input, output, MASTER_KEY, TIMEOUT_MS, ac.signal)
      ).rejects.toThrow();
    });
  });
});
