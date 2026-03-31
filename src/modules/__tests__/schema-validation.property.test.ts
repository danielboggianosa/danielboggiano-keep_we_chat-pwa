/**
 * Feature: production-readiness, Property 3: Validación de esquema de peticiones
 *
 * Validates: Requirements 1.6, 1.7
 *
 * Property: For all request bodies that do not match the defined Zod schema,
 * safeParse must return success: false with a list of validation errors.
 * For all request bodies that match the schema, safeParse must return success: true.
 *
 * Focuses on registerSchema and createTranscriptionSchema as representative schemas.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';

// ── Schemas (mirrored from services/api-gateway/src/schemas/index.ts) ──

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const createTranscriptionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  language: z.enum(['es', 'en'], { message: 'Language must be "es" or "en"' }),
  audioFileUrl: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  recordedAt: z.string().datetime().optional(),
  segments: z
    .array(
      z.object({
        startTime: z.number().nonnegative(),
        endTime: z.number().positive(),
        content: z.string().min(1),
        confidence: z.number().min(0).max(1),
        speakerId: z.string().optional(),
        speakerLabel: z.string().optional(),
      }),
    )
    .optional(),
  speakers: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        identifiedName: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

// ── Valid body arbitraries ─────────────────────────────────────────

/** Generate a valid email address. */
const validEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
    fc.stringMatching(/^[a-z]{2,8}$/),
    fc.constantFrom('com', 'org', 'net', 'io', 'dev'),
  )
  .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/** Generate a valid name (1-200 chars). */
const validNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generate a valid password (8-128 chars). */
const validPasswordArb = fc.string({ minLength: 8, maxLength: 40 });

/** Generate a valid register body. */
const validRegisterBodyArb = fc
  .tuple(validEmailArb, validNameArb, validPasswordArb)
  .map(([email, name, password]) => ({ email, name, password }));

/** Generate a valid language. */
const validLanguageArb = fc.constantFrom('es' as const, 'en' as const);

/** Generate a valid title (1-500 chars). */
const validTitleArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

/** Generate a valid segment. */
const validSegmentArb = fc
  .tuple(
    fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
    fc.float({ min: Math.fround(0.01), max: Math.fround(2000), noNaN: true }),
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.length > 0),
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  )
  .map(([start, delta, content, confidence]) => ({
    startTime: start,
    endTime: start + delta,
    content,
    confidence,
  }));

/** Generate a valid speaker. */
const validSpeakerArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.length > 0),
  )
  .map(([label]) => ({ label }));

/** Generate a valid createTranscription body. */
const validTranscriptionBodyArb = fc
  .tuple(
    validTitleArb,
    validLanguageArb,
    fc.option(fc.array(validSegmentArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
    fc.option(fc.array(validSpeakerArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
  )
  .map(([title, language, segments, speakers]) => ({
    title,
    language,
    ...(segments !== undefined ? { segments } : {}),
    ...(speakers !== undefined ? { speakers } : {}),
  }));

// ── Invalid body arbitraries ──────────────────────────────────────

type InvalidMutation = 'missing_required' | 'wrong_type' | 'out_of_range' | 'invalid_format';

const mutationTypeArb = fc.constantFrom<InvalidMutation>(
  'missing_required',
  'wrong_type',
  'out_of_range',
  'invalid_format',
);

/** Produce an invalid register body by applying a random mutation. */
const invalidRegisterBodyArb = fc
  .tuple(validRegisterBodyArb, mutationTypeArb, fc.integer({ min: 0, max: 2 }))
  .map(([body, mutation, fieldIdx]) => {
    const mutated = { ...body } as Record<string, unknown>;
    const fields = ['email', 'name', 'password'] as const;
    const field = fields[fieldIdx % fields.length];

    switch (mutation) {
      case 'missing_required':
        delete mutated[field];
        break;
      case 'wrong_type':
        mutated[field] = field === 'password' ? 12345 : [1, 2, 3];
        break;
      case 'out_of_range':
        if (field === 'password') mutated.password = 'short'; // < 8 chars
        else if (field === 'name') mutated.name = '';
        else mutated.email = '';
        break;
      case 'invalid_format':
        if (field === 'email') mutated.email = 'not-an-email';
        else if (field === 'password') mutated.password = 'abc'; // too short
        else mutated.name = '';
        break;
    }
    return mutated;
  });

/** Produce an invalid createTranscription body by applying a random mutation. */
const invalidTranscriptionBodyArb = fc
  .tuple(validTranscriptionBodyArb, mutationTypeArb, fc.integer({ min: 0, max: 3 }))
  .map(([body, mutation, fieldIdx]) => {
    const mutated = { ...body } as Record<string, unknown>;
    const fields = ['title', 'language', 'segments', 'confidence'] as const;
    const field = fields[fieldIdx % fields.length];

    switch (mutation) {
      case 'missing_required':
        if (field === 'title') delete mutated.title;
        else if (field === 'language') delete mutated.language;
        else { delete mutated.title; delete mutated.language; }
        break;
      case 'wrong_type':
        if (field === 'title') mutated.title = 99999;
        else if (field === 'language') mutated.language = 42;
        else mutated.title = { nested: true };
        break;
      case 'out_of_range':
        if (field === 'title') mutated.title = '';
        else if (field === 'language') mutated.language = 'fr'; // not in enum
        else mutated.segments = [{ startTime: -5, endTime: 0, content: '', confidence: 2 }];
        break;
      case 'invalid_format':
        if (field === 'language') mutated.language = 'INVALID';
        else if (field === 'title') mutated.title = '';
        else mutated.segments = [{ startTime: 'not-a-number', endTime: 'bad', content: 123, confidence: 'high' }];
        break;
    }
    return mutated;
  });

// ── Combined arbitraries ──────────────────────────────────────────

/** A valid body paired with its schema. */
const validInputArb = fc.oneof(
  validRegisterBodyArb.map((body) => ({ schema: registerSchema, body, schemaName: 'register' })),
  validTranscriptionBodyArb.map((body) => ({ schema: createTranscriptionSchema, body, schemaName: 'createTranscription' })),
);

/** An invalid body paired with its schema. */
const invalidInputArb = fc.oneof(
  invalidRegisterBodyArb.map((body) => ({ schema: registerSchema, body, schemaName: 'register' })),
  invalidTranscriptionBodyArb.map((body) => ({ schema: createTranscriptionSchema, body, schemaName: 'createTranscription' })),
);

/** Either a valid or invalid body with its schema and expected outcome. */
const schemaTestInputArb = fc.oneof(
  validInputArb.map((input) => ({ ...input, shouldBeValid: true })),
  invalidInputArb.map((input) => ({ ...input, shouldBeValid: false })),
);

// ── Property Test ─────────────────────────────────────────────────

describe('Property 3: Validación de esquema de peticiones', () => {
  it('valid bodies pass safeParse and invalid bodies fail with error details', () => {
    fc.assert(
      fc.property(schemaTestInputArb, ({ schema, body, shouldBeValid }) => {
        const result = schema.safeParse(body);

        if (shouldBeValid) {
          // Valid bodies MUST be accepted
          expect(result.success).toBe(true);
        } else {
          // Invalid bodies MUST be rejected
          expect(result.success).toBe(false);

          if (!result.success) {
            // Must contain error details (equivalent to 400 response with field errors)
            expect(result.error).toBeDefined();
            expect(result.error.issues.length).toBeGreaterThan(0);

            // Each issue must have a message
            for (const issue of result.error.issues) {
              expect(typeof issue.message).toBe('string');
              expect(issue.message.length).toBeGreaterThan(0);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
