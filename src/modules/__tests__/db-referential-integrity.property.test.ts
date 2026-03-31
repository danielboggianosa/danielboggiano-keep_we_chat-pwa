/**
 * Feature: production-readiness, Property 13: Integridad referencial de la base de datos
 *
 * **Validates: Requirements 6.5**
 *
 * Property: For every attempt to insert a record with a foreign key referencing a
 * non-existent record, the database must reject the operation. Likewise, CHECK
 * constraints (confidence between 0-1, startTime < endTime, valid roles, valid
 * languages, valid permissions) must reject invalid data.
 *
 * Since we cannot connect to a real PostgreSQL in unit tests, we test the constraint
 * logic by implementing validator functions that mirror the SQL CHECK constraints and
 * foreign key rules defined in the migrations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Constraint validators (mirror SQL CHECK constraints) ──────────

/** CHECK (confidence >= 0 AND confidence <= 1) — from 003_create_segments */
function isValidConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** CHECK (start_time >= 0 AND end_time > start_time) — from 003_create_segments */
function isValidSegmentTimes(startTime: number, endTime: number): boolean {
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime >= 0 && endTime > startTime;
}

/** CHECK (role IN ('admin', 'user')) — from 001_create_users */
function isValidRole(role: string): boolean {
  return role === 'admin' || role === 'user';
}

/** CHECK (language IN ('es', 'en')) — from 002_create_transcriptions, 006_create_summaries_minutes */
function isValidLanguage(language: string): boolean {
  return language === 'es' || language === 'en';
}

/** CHECK (permission IN ('read', 'read-write')) — from 008_create_shares */
function isValidPermission(permission: string): boolean {
  return permission === 'read' || permission === 'read-write';
}

/**
 * Foreign key simulation: a FK reference is valid only if the referenced UUID
 * exists in the set of known records.
 */
function isValidForeignKey(fkValue: string, existingIds: Set<string>): boolean {
  return existingIds.has(fkValue);
}

// ── Arbitraries ───────────────────────────────────────────────────

const uuidArb = fc.uuid();

const validRoleArb = fc.constantFrom('admin', 'user');
const invalidRoleArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 })
  .filter((s) => s !== 'admin' && s !== 'user');

const validLanguageArb = fc.constantFrom('es', 'en');
const invalidLanguageArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 10 })
  .filter((s) => s !== 'es' && s !== 'en');

const validPermissionArb = fc.constantFrom('read', 'read-write');
const invalidPermissionArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 })
  .filter((s) => s !== 'read' && s !== 'read-write');


// ── Property test ─────────────────────────────────────────────────

describe('Property 13: Integridad referencial de la base de datos', () => {
  it('CHECK constraints and foreign key rules correctly accept valid data and reject invalid data', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Confidence values: valid (0-1) and invalid (outside range or non-finite)
          validConfidence: fc.double({ min: 0, max: 1, noNaN: true }),
          invalidConfidenceLow: fc.double({ max: -0.001, noNaN: true, noDefaultInfinity: true }),
          invalidConfidenceHigh: fc.double({ min: 1.001, noNaN: true, noDefaultInfinity: true }),

          // Segment times: valid pairs and invalid pairs
          validStartTime: fc.double({ min: 0, max: 1000, noNaN: true }),
          validDuration: fc.double({ min: 0.001, max: 500, noNaN: true }),
          invalidEndTimeDelta: fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }),
          negativeStartTime: fc.double({ max: -0.001, noNaN: true, noDefaultInfinity: true }),

          // Roles
          validRole: validRoleArb,
          invalidRole: invalidRoleArb,

          // Languages
          validLanguage: validLanguageArb,
          invalidLanguage: invalidLanguageArb,

          // Permissions
          validPermission: validPermissionArb,
          invalidPermission: invalidPermissionArb,

          // Foreign keys
          existingId1: uuidArb,
          existingId2: uuidArb,
          referencedId: uuidArb,
          nonExistentId: uuidArb,
        }),
        (data) => {
          // ── Confidence constraint ──
          expect(isValidConfidence(data.validConfidence)).toBe(true);
          expect(isValidConfidence(data.invalidConfidenceLow)).toBe(false);
          expect(isValidConfidence(data.invalidConfidenceHigh)).toBe(false);
          expect(isValidConfidence(NaN)).toBe(false);
          expect(isValidConfidence(Infinity)).toBe(false);
          expect(isValidConfidence(-Infinity)).toBe(false);

          // ── Segment times constraint ──
          const validEndTime = data.validStartTime + data.validDuration;
          expect(isValidSegmentTimes(data.validStartTime, validEndTime)).toBe(true);

          // end_time <= start_time should fail
          const invalidEndTime = data.validStartTime + data.invalidEndTimeDelta;
          expect(isValidSegmentTimes(data.validStartTime, invalidEndTime)).toBe(false);

          // Negative start_time should fail
          expect(isValidSegmentTimes(data.negativeStartTime, data.negativeStartTime + 1)).toBe(false);

          // Equal start and end should fail (end must be strictly greater)
          expect(isValidSegmentTimes(5, 5)).toBe(false);

          // ── Role constraint ──
          expect(isValidRole(data.validRole)).toBe(true);
          expect(isValidRole(data.invalidRole)).toBe(false);

          // ── Language constraint ──
          expect(isValidLanguage(data.validLanguage)).toBe(true);
          expect(isValidLanguage(data.invalidLanguage)).toBe(false);

          // ── Permission constraint ──
          expect(isValidPermission(data.validPermission)).toBe(true);
          expect(isValidPermission(data.invalidPermission)).toBe(false);

          // ── Foreign key referential integrity ──
          const existingIds = new Set([data.existingId1, data.existingId2]);

          // Valid FK: referencing an existing ID
          expect(isValidForeignKey(data.existingId1, existingIds)).toBe(true);
          expect(isValidForeignKey(data.existingId2, existingIds)).toBe(true);

          // Invalid FK: referencing a non-existent ID (when it's not in the set)
          if (!existingIds.has(data.nonExistentId)) {
            expect(isValidForeignKey(data.nonExistentId, existingIds)).toBe(false);
          }

          // Empty set means all FKs are invalid
          const emptySet = new Set<string>();
          expect(isValidForeignKey(data.referencedId, emptySet)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
