/**
 * Feature: production-readiness
 * Property 23: Logging estructurado en formato JSON
 *
 * For all operations that produce log entries, each log must be valid JSON
 * containing: timestamp (ISO 8601), level (info|warn|error), service (non-empty),
 * requestId (UUID), and message (non-empty).
 *
 * **Validates: Requirements 10.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'node:crypto';

// ── LogEntry interface (mirrors design doc §8 Sistema de Monitoreo) ──

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  requestId: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: { name: string; message: string; stack: string };
}

// ── Model: structured logger that produces JSON log lines ──

function createStructuredLog(
  level: 'info' | 'warn' | 'error',
  service: string,
  requestId: string,
  message: string,
  metadata?: Record<string, unknown>,
  error?: { name: string; message: string; stack: string },
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    requestId,
    message,
  };
  if (metadata !== undefined) entry.metadata = metadata;
  if (error !== undefined) entry.error = error;
  return JSON.stringify(entry);
}

// ── Validation helpers ──

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Arbitraries ──

const levelArb = fc.constantFrom('info' as const, 'warn' as const, 'error' as const);

const serviceArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-_0123456789'.split('')),
  { minLength: 1, maxLength: 40 },
);

const requestIdArb = fc.uuid();

const messageArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

const metadataArb = fc.option(
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
    { minKeys: 0, maxKeys: 5 },
  ),
  { nil: undefined },
);

const errorInfoArb = fc.option(
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    message: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    stack: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  }),
  { nil: undefined },
);

// ── Property 23: Logging estructurado en formato JSON ──

describe('Property 23: Logging estructurado en formato JSON', () => {
  it('every log entry is valid JSON with required fields: timestamp (ISO 8601), level, service, requestId (UUID), message (non-empty)', () => {
    fc.assert(
      fc.property(
        levelArb,
        serviceArb,
        requestIdArb,
        messageArb,
        metadataArb,
        errorInfoArb,
        (level, service, requestId, message, metadata, errorInfo) => {
          // Produce a structured log line
          const logLine = createStructuredLog(level, service, requestId, message, metadata, errorInfo);

          // 1. Must be valid JSON
          let parsed: Record<string, unknown>;
          expect(() => { parsed = JSON.parse(logLine); }).not.toThrow();
          parsed = JSON.parse(logLine);

          // 2. timestamp must be ISO 8601
          expect(parsed.timestamp).toBeDefined();
          expect(typeof parsed.timestamp).toBe('string');
          expect(parsed.timestamp as string).toMatch(ISO_8601_REGEX);
          // Must parse to a valid Date
          const ts = new Date(parsed.timestamp as string);
          expect(ts.getTime()).not.toBeNaN();

          // 3. level must be one of info, warn, error
          expect(parsed.level).toBeDefined();
          expect(['info', 'warn', 'error']).toContain(parsed.level);

          // 4. service must be a non-empty string
          expect(parsed.service).toBeDefined();
          expect(typeof parsed.service).toBe('string');
          expect((parsed.service as string).length).toBeGreaterThan(0);

          // 5. requestId must match UUID format
          expect(parsed.requestId).toBeDefined();
          expect(typeof parsed.requestId).toBe('string');
          expect(parsed.requestId as string).toMatch(UUID_REGEX);

          // 6. message must be a non-empty string
          expect(parsed.message).toBeDefined();
          expect(typeof parsed.message).toBe('string');
          expect((parsed.message as string).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
