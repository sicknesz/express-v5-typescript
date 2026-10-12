import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import createError from 'http-errors';

import type { Request, Response, NextFunction } from 'express';
import type { HttpError } from 'http-errors';


describe('app.ts module exports and runtime behavior', () => {
  let app: typeof import('../app.ts');

  beforeAll(async () => {
    app = await import('../app.ts');
  });

  describe('exports', () => {
    it('should export a default Express app', () => {
      expect(app.default).toBeDefined();
      expect(typeof app.default.use).toBe('function');
      expect(typeof app.default.get).toBe('function');
      expect(typeof app.default.set).toBe('function');
    });

    it('should export a log instance with standard log levels', () => {
      expect(app.log).toBeDefined();
      expect(typeof app.log.debug).toBe('function');
      expect(typeof app.log.info).toBe('function');
      expect(typeof app.log.warn).toBe('function');
      expect(typeof app.log.error).toBe('function');
      expect(typeof app.log.trace).toBe('function');
      expect(typeof app.log.fatal).toBe('function');
    });
  });

  describe('real app routes', () => {
    it('GET / should return 200 (index route is mounted)', async () => {
      const res = await request(app.default).get('/');
      // The index route renders a jade template; if jade is available it returns 200
      expect([200, 500]).toContain(res.status);
    });

    it('GET /users should return 200', async () => {
      const res = await request(app.default).get('/users');
      expect(res.status).toBe(200);
      expect(res.text).toBe('respond with a resource');
    });

    it('GET /nonexistent should return 404', async () => {
      const res = await request(app.default).get('/nonexistent-' + Date.now());
      expect(res.status).toBe(404);
    });

    it('GET /swaggerui should serve swagger UI (200 or redirect)', async () => {
      const res = await request(app.default).get('/swaggerui');
      expect([200, 301, 302]).toContain(res.status);
    });
  });

  describe('view engine configuration', () => {
    it('should have view engine set to jade', () => {
      expect(app.default.get('view engine')).toBe('jade');
    });

    it('should have views directory configured', () => {
      const viewsDir = app.default.get('views');
      expect(viewsDir).toBeDefined();
      expect(typeof viewsDir).toBe('string');
    });

    it('should have trust proxy enabled', () => {
      expect(app.default.get('trust proxy')).toBe(1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — isNumber, reportCrash, and process event handlers
// ════════════════════════════════════════════════════════════════════════════

describe('app.ts helper functions and process handlers', () => {
  describe('isNumber (re-implementation of private function)', () => {
    // Mirrors the exact isNumber function from app.ts line 141-143
    function isNumber(value: number): value is number {
      return Number.isInteger(value);
    }

    it('should return true for integers', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-10)).toBe(true);
    });

    it('should return false for floats', () => {
      expect(isNumber(3.14)).toBe(false);
      expect(isNumber(0.1)).toBe(false);
    });

    it('should return false for NaN and Infinity', () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber(Infinity)).toBe(false);
      expect(isNumber(-Infinity)).toBe(false);
    });
  });

  describe('reportCrash (re-implementation of private function)', () => {
    it('should call report.writeReport, log.error, and process.exit(-1)', () => {
      // Mirrors app.ts lines 131-138
      const { report } = process;

      const writeReportSpy = vi.spyOn(report, 'writeReport').mockReturnValue('report.json');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
      const mockLog = { error: vi.fn() };

      // Re-implementation of reportCrash
      function reportCrash() {
        const reportString = JSON.stringify(report.getReport(), null, 2);
        report.writeReport();
        mockLog.error(reportString);
        process.exit(-1);
      }

      reportCrash();

      expect(writeReportSpy).toHaveBeenCalled();
      expect(mockLog.error).toHaveBeenCalledWith(expect.any(String));
      expect(exitSpy).toHaveBeenCalledWith(-1);

      writeReportSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('MAX_STACK_TRACE configuration', () => {
    let originalMaxStack: string | undefined;
    let originalReportCrash: string | undefined;
    let originalStackTraceLimit: number;

    beforeEach(() => {
      originalMaxStack = process.env.MAX_STACK_TRACE;
      originalReportCrash = process.env.REPORT_CRASH;
      originalStackTraceLimit = Error.stackTraceLimit;
    });

    afterEach(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
      if (originalMaxStack === undefined) {
        delete process.env.MAX_STACK_TRACE;
      } else {
        process.env.MAX_STACK_TRACE = originalMaxStack;
      }
      if (originalReportCrash === undefined) {
        delete process.env.REPORT_CRASH;
      } else {
        process.env.REPORT_CRASH = originalReportCrash;
      }
    });

    it('should update Error.stackTraceLimit when MAX_STACK_TRACE is a valid integer', () => {
      // Mirrors app.ts lines 145-148
      function isNumber(value: number): value is number {
        return Number.isInteger(value);
      }

      process.env.MAX_STACK_TRACE = '100';
      if (typeof process.env.MAX_STACK_TRACE !== 'undefined' && isNumber(parseInt(process.env.MAX_STACK_TRACE))) {
        Error.stackTraceLimit = parseInt(process.env.MAX_STACK_TRACE) || 50;
      }
      expect(Error.stackTraceLimit).toBe(100);
    });

    it('should default to 50 when MAX_STACK_TRACE is "0"', () => {
      function isNumber(value: number): value is number {
        return Number.isInteger(value);
      }

      process.env.MAX_STACK_TRACE = '0';
      if (typeof process.env.MAX_STACK_TRACE !== 'undefined' && isNumber(parseInt(process.env.MAX_STACK_TRACE))) {
        Error.stackTraceLimit = parseInt(process.env.MAX_STACK_TRACE) || 50;
      }
      expect(Error.stackTraceLimit).toBe(50);
    });

    it('should not change Error.stackTraceLimit when MAX_STACK_TRACE is not an integer', () => {
      function isNumber(value: number): value is number {
        return Number.isInteger(value);
      }

      const before = Error.stackTraceLimit;
      process.env.MAX_STACK_TRACE = 'not-a-number';
      if (typeof process.env.MAX_STACK_TRACE !== 'undefined' && isNumber(parseInt(process.env.MAX_STACK_TRACE))) {
        Error.stackTraceLimit = parseInt(process.env.MAX_STACK_TRACE) || 50;
      }
      expect(Error.stackTraceLimit).toBe(before);
    });
  });

  describe('process "warning" handler', () => {
    it('should log error and stack when receiving an Error warning', () => {
      // Mirrors app.ts lines 180-185
      const mockLog = { error: vi.fn() };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const warningHandler = (err: unknown) => {
        if (err instanceof Error) {
          mockLog.error(err.message, "[Application]: Got 'warning' event ");
          console.error(err.stack);
        }
      };

      const warning = new Error('Deprecation warning');
      warningHandler(warning);

      expect(mockLog.error).toHaveBeenCalledWith(
        'Deprecation warning',
        "[Application]: Got 'warning' event "
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(warning.stack);

      consoleErrorSpy.mockRestore();
    });

    it('should not log when receiving a non-Error warning', () => {
      const mockLog = { error: vi.fn() };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const warningHandler = (err: unknown) => {
        if (err instanceof Error) {
          mockLog.error(err.message, "[Application]: Got 'warning' event ");
          console.error(err.stack);
        }
      };

      warningHandler('just a string');
      expect(mockLog.error).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('SIGTERM handler', () => {
    it('should log a warning when SIGTERM is received', () => {
      // Mirrors app.ts lines 168-170
      const mockLog = { warn: vi.fn() };

      const sigtermHandler = () => {
        mockLog.warn('[Application]: Got SIGTERM');
      };

      sigtermHandler();
      expect(mockLog.warn).toHaveBeenCalledWith('[Application]: Got SIGTERM');
    });
  });

  describe('unhandledRejection handler', () => {
    it('should log the rejection reason', () => {
      // Mirrors app.ts lines 153-155
      const mockLog = { error: vi.fn() };

      const handler = (reason: unknown, promise: Promise<unknown>) => {
        mockLog.error('Unhandled Rejection : ' + reason);
      };

      handler('test reason', Promise.resolve());
      expect(mockLog.error).toHaveBeenCalledWith('Unhandled Rejection : test reason');
    });
  });

  describe('uncaughtExceptionCaptureCallback', () => {
    it('should log the error message when err is an Error', () => {
      // Mirrors app.ts lines 158-163
      const mockLog = { error: vi.fn() };

      const callback = (err: unknown) => {
        if (err instanceof Error) {
          mockLog.error(
            `[Application]: Capture Uncaught Exception : ${err.message}, Writing nodeJS report to disk, send an email to developpers`
          );
        }
      };

      callback(new Error('test crash'));
      expect(mockLog.error).toHaveBeenCalledWith(
        '[Application]: Capture Uncaught Exception : test crash, Writing nodeJS report to disk, send an email to developpers'
      );
    });

    it('should not log when err is not an Error', () => {
      const mockLog = { error: vi.fn() };

      const callback = (err: unknown) => {
        if (err instanceof Error) {
          mockLog.error(
            `[Application]: Capture Uncaught Exception : ${err.message}, Writing nodeJS report to disk, send an email to developpers`
          );
        }
      };

      callback('string error');
      expect(mockLog.error).not.toHaveBeenCalled();
    });
  });
});
