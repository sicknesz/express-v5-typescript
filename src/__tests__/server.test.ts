import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { HttpError } from 'http-errors';
import type { AddressInfo } from 'net';

/**
 * Tests for src/server.ts
 *
 * server.ts has heavy top-level side effects (imports app.ts which in turn
 * configures bunyan, dotenv, favicon, etc., then binds a server to a port).
 *
 * Strategy:
 * - We mock `../app.ts` so importing server.ts doesn't bootstrap the full app.
 * - We mock `http.createServer` and `server.listen` to prevent real port binding.
 * - This allows us to exercise normalizePort, onError, onListening as they
 *   actually run inside server.ts, giving us real coverage.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Fake Express app
const fakeApp = { set: vi.fn() };

// Fake logger
const fakeLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock app.ts before importing server.ts
vi.mock('../app.ts', () => ({
  default: fakeApp,
  log: fakeLog,
}));

// Track event handlers and the fake server instance
let serverEventHandlers: Record<string, Function> = {};
let fakeServer: {
  listen: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  address: ReturnType<typeof vi.fn>;
};

vi.mock('http', async (importOriginal) => {
  const original = await importOriginal<typeof import('http')>();
  return {
    ...original,
    default: {
      ...original,
      createServer: vi.fn(() => {
        fakeServer = {
          listen: vi.fn(),
          on: vi.fn((event: string, handler: Function) => {
            serverEventHandlers[event] = handler;
          }),
          address: vi.fn(() => ({ address: '0.0.0.0', family: 'IPv4', port: 3000 })),
        };
        return fakeServer;
      }),
    },
  };
});

describe('server.ts', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Capture process.exit and console.error before module load
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Dynamically import server.ts — this runs top-level code and registers
    // event handlers on our fake server
    await import('../server.ts');
  });

  afterAll(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    exitSpy.mockClear();
    consoleErrorSpy.mockClear();
    fakeLog.debug.mockClear();
    fakeLog.info.mockClear();
  });

  describe('module initialization', () => {
    it('should call log.debug on startup', () => {
      // The top-level `log.debug('express:server')` runs at import time
      expect(fakeLog.debug).toHaveBeenCalled();
    });

    it('should set the port on the app', () => {
      expect(fakeApp.set).toHaveBeenCalledWith('port', expect.anything());
    });

    it('should create an HTTP server', () => {
      const httpMod = vi.mocked(await import('http'));
      expect(httpMod.default.createServer).toHaveBeenCalledWith(fakeApp);
    });

    it('should call server.listen with the port', () => {
      expect(fakeServer.listen).toHaveBeenCalled();
    });

    it('should register "error" and "listening" event handlers', () => {
      expect(serverEventHandlers['error']).toBeDefined();
      expect(serverEventHandlers['listening']).toBeDefined();
    });
  });

  describe('normalizePort (via port assignment)', () => {
    it('should default to port 3000 when PORT is not set', () => {
      // The module uses normalizePort(process.env.PORT || '3000')
      // Since PORT is not set, it should default to 3000
      expect(fakeApp.set).toHaveBeenCalledWith('port', 3000);
    });
  });

  describe('onError handler', () => {
    it('should throw if error.syscall is not "listen"', () => {
      const handler = serverEventHandlers['error'];
      const error = Object.assign(new Error('bad'), {
        syscall: 'read',
        code: 'ECONNRESET',
      }) as HttpError;
      expect(() => handler(error)).toThrow('bad');
    });

    it('should log and exit(1) for EACCES', () => {
      const handler = serverEventHandlers['error'];
      const error = Object.assign(new Error('access'), {
        syscall: 'listen',
        code: 'EACCES',
      }) as HttpError;
      handler(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('requires elevated privileges')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should log and exit(1) for EADDRINUSE', () => {
      const handler = serverEventHandlers['error'];
      const error = Object.assign(new Error('in use'), {
        syscall: 'listen',
        code: 'EADDRINUSE',
      }) as HttpError;
      handler(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('is already in use')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should throw for unknown error codes with syscall "listen"', () => {
      const handler = serverEventHandlers['error'];
      const error = Object.assign(new Error('unknown'), {
        syscall: 'listen',
        code: 'ENOTFOUND',
      }) as HttpError;
      expect(() => handler(error)).toThrow('unknown');
    });

    it('should format the bind string with "Port" for numeric ports', () => {
      const handler = serverEventHandlers['error'];
      const error = Object.assign(new Error('access'), {
        syscall: 'listen',
        code: 'EACCES',
      }) as HttpError;
      handler(error);
      // Port 3000 is the default
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Port \d+ requires elevated privileges/)
      );
    });
  });

  describe('onListening handler', () => {
    it('should log the port when server is listening', () => {
      fakeServer.address.mockReturnValueOnce({
        address: '0.0.0.0',
        family: 'IPv4',
        port: 3000,
      });
      const handler = serverEventHandlers['listening'];
      handler();
      expect(fakeLog.info).toHaveBeenCalledWith(
        expect.stringContaining('Listening on')
      );
    });

    it('should not log when address is null', () => {
      fakeServer.address.mockReturnValueOnce(null);
      const handler = serverEventHandlers['listening'];
      fakeLog.info.mockClear();
      handler();
      expect(fakeLog.info).not.toHaveBeenCalled();
    });
  });

  describe('HTTP server integration (real server)', () => {
    let realServer: http.Server;

    afterEach(() => {
      return new Promise<void>((resolve) => {
        if (realServer?.listening) {
          realServer.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it('should be able to create and start a real HTTP server on a random port', async () => {
      const { default: expressImport } = await vi.importActual<typeof import('express')>('express');
      const testApp = expressImport();
      testApp.get('/health', (req, res) => res.json({ status: 'ok' }));

      const { default: realHttp } = await vi.importActual<typeof import('http')>('http');
      realServer = realHttp.createServer(testApp);

      await new Promise<void>((resolve, reject) => {
        realServer.listen(0, () => resolve());
        realServer.on('error', reject);
      });

      const addr = realServer.address() as AddressInfo;
      expect(addr).toBeDefined();
      expect(addr.port).toBeGreaterThan(0);

      const res = await fetch(`http://127.0.0.1:${addr.port}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should emit EADDRINUSE when binding the same port twice', async () => {
      const { default: expressImport } = await vi.importActual<typeof import('express')>('express');
      const testApp = expressImport();

      const { default: realHttp } = await vi.importActual<typeof import('http')>('http');
      realServer = realHttp.createServer(testApp);

      await new Promise<void>((resolve) => {
        realServer.listen(0, () => resolve());
      });

      const addr = realServer.address() as AddressInfo;
      const server2 = realHttp.createServer(testApp);

      const error = await new Promise<NodeJS.ErrnoException>((resolve) => {
        server2.on('error', (err) => resolve(err));
        server2.listen(addr.port);
      });

      expect(error.code).toBe('EADDRINUSE');
      await new Promise<void>((resolve) => server2.close(() => resolve()));
    });
  });
});
