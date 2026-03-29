/**
 * Feature: meeting-transcription, Property 11: Control de acceso — otorgar y revocar
 *
 * Validates: Requirements 9.1, 9.3
 *
 * Property: For every user, a grant followed by a revoke results in access denied,
 * and a revoke followed by a grant results in access granted. The final access state
 * depends solely on the last operation in the sequence.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UserService } from '../user-service';
import type { User } from '../user-service';

// ── Types ─────────────────────────────────────────────────────────

type AccessOp = 'grant' | 'revoke';

interface AccessOpEntry {
  targetIndex: number; // index into the generated users array
  op: AccessOp;
}

// ── Arbitraries ───────────────────────────────────────────────────

/** Generate a single access operation targeting a random user index. */
const accessOpArb = (maxUserIndex: number): fc.Arbitrary<AccessOpEntry> =>
  fc.record({
    targetIndex: fc.integer({ min: 0, max: maxUserIndex }),
    op: fc.constantFrom<AccessOp>('grant', 'revoke'),
  });

/**
 * Generate a sequence of grant/revoke operations for N users.
 * Each operation targets one of the N users by index.
 */
const opsSequenceArb = (maxUserIndex: number): fc.Arbitrary<AccessOpEntry[]> =>
  fc.array(accessOpArb(maxUserIndex), { minLength: 1, maxLength: 30 });

/** Number of random target users (1–5). */
const userCountArb = fc.integer({ min: 1, max: 5 });

// ── Helpers ───────────────────────────────────────────────────────

function buildService(userCount: number): { service: UserService; admin: User; users: User[] } {
  const service = new UserService();
  const admin: User = { id: 'admin-0', role: 'admin', isActive: true };
  service.addUser(admin);

  const users: User[] = [];
  for (let i = 0; i < userCount; i++) {
    const user: User = { id: `user-${i}`, role: 'user', isActive: true };
    service.addUser(user);
    users.push(user);
  }

  return { service, admin, users };
}

// ── Property tests ────────────────────────────────────────────────

describe('Property 11: Control de acceso — otorgar y revocar', () => {
  it('final access state depends on the last operation for each user', () => {
    fc.assert(
      fc.property(
        userCountArb.chain((count) =>
          fc.tuple(fc.constant(count), opsSequenceArb(count - 1)),
        ),
        ([userCount, ops]) => {
          const { service, admin, users } = buildService(userCount);

          // Apply all operations in sequence
          for (const { targetIndex, op } of ops) {
            const targetUser = users[targetIndex];
            if (op === 'grant') {
              service.grantAccess(admin.id, targetUser.id);
            } else {
              service.revokeAccess(admin.id, targetUser.id);
            }
          }

          // Determine expected final state per user: last op wins
          const lastOpPerUser = new Map<number, AccessOp>();
          for (const { targetIndex, op } of ops) {
            lastOpPerUser.set(targetIndex, op);
          }

          // Verify each user's access matches the last operation applied
          for (const [idx, lastOp] of lastOpPerUser.entries()) {
            const userId = users[idx].id;
            const expectedAccess = lastOp === 'grant';
            expect(service.hasAccess(userId)).toBe(expectedAccess);
          }

          // Users that were never targeted should still have their initial state (active)
          for (let i = 0; i < userCount; i++) {
            if (!lastOpPerUser.has(i)) {
              expect(service.hasAccess(users[i].id)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('grant followed by revoke always results in access denied', () => {
    fc.assert(
      fc.property(
        userCountArb,
        (userCount) => {
          const { service, admin, users } = buildService(userCount);

          // For each user: grant then revoke
          for (const user of users) {
            service.grantAccess(admin.id, user.id);
            expect(service.hasAccess(user.id)).toBe(true);

            service.revokeAccess(admin.id, user.id);
            expect(service.hasAccess(user.id)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revoke followed by grant always results in access granted', () => {
    fc.assert(
      fc.property(
        userCountArb,
        (userCount) => {
          const { service, admin, users } = buildService(userCount);

          // For each user: revoke then grant
          for (const user of users) {
            service.revokeAccess(admin.id, user.id);
            expect(service.hasAccess(user.id)).toBe(false);

            service.grantAccess(admin.id, user.id);
            expect(service.hasAccess(user.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
