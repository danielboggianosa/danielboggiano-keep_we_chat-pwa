/**
 * Feature: meeting-transcription, Property 10: Integridad del log de ediciones y propiedad de transcripciones
 *
 * **Validates: Requirements 8.2, 9.2**
 *
 * Property: For every edit performed on a transcription, an EditRecord must be created
 * with the correct `editedBy` (the user who performed the edit) and a valid `editedAt`
 * timestamp. Additionally, every transcription must have an `ownerId` corresponding
 * to the user who created it.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EditService } from '../edit-service';
import { UserService } from '../user-service';
import type { User } from '../user-service';

// ── Types ─────────────────────────────────────────────────────────

interface EditOp {
  /** Index into the authorized users array */
  userIndex: number;
  segmentIndex: number;
  newText: string;
}

// ── Arbitraries ───────────────────────────────────────────────────

const segmentTextArb: fc.Arbitrary<string> = fc.stringOf(
  fc.char().filter((c) => c.length > 0 && c !== '\0'),
  { minLength: 1, maxLength: 50 },
);

const segmentCountArb = fc.integer({ min: 1, max: 10 });

/** Number of additional authorized (read-write) users besides the owner (0–4). */
const extraUserCountArb = fc.integer({ min: 0, max: 4 });

const editOpArb = (
  maxUserIndex: number,
  maxSegmentIndex: number,
): fc.Arbitrary<EditOp> =>
  fc.record({
    userIndex: fc.integer({ min: 0, max: maxUserIndex }),
    segmentIndex: fc.integer({ min: 0, max: maxSegmentIndex }),
    newText: segmentTextArb,
  });

// ── Helpers ───────────────────────────────────────────────────────

function setupServices(
  segmentCount: number,
  extraUserCount: number,
): {
  editService: EditService;
  userService: UserService;
  owner: User;
  authorizedUsers: User[];
  transcriptionId: string;
} {
  const userService = new UserService();
  const editService = new EditService(userService);

  const owner: User = { id: 'owner-1', role: 'user', isActive: true };
  userService.addUser(owner);

  const transcriptionId = 'transcription-1';
  userService.registerTranscription(transcriptionId, owner.id);

  // Owner is always the first authorized user (index 0)
  const authorizedUsers: User[] = [owner];

  for (let i = 0; i < extraUserCount; i++) {
    const user: User = { id: `rw-user-${i}`, role: 'user', isActive: true };
    userService.addUser(user);
    userService.shareTranscription(owner.id, transcriptionId, user.id, 'read-write');
    authorizedUsers.push(user);
  }

  const segments = Array.from({ length: segmentCount }, (_, i) => `Original segment ${i}`);
  editService.registerSegments(transcriptionId, segments);

  return { editService, userService, owner, authorizedUsers, transcriptionId };
}

// ── Property tests ────────────────────────────────────────────────

describe('Property 10: Integridad del log de ediciones y propiedad de transcripciones', () => {
  it('each edit creates an EditRecord with correct editedBy and valid editedAt', () => {
    fc.assert(
      fc.property(
        segmentCountArb.chain((segCount) =>
          extraUserCountArb.chain((extraCount) => {
            const maxUserIndex = extraCount; // 0 = owner only
            const maxSegIndex = segCount - 1;
            return fc.tuple(
              fc.constant(segCount),
              fc.constant(extraCount),
              fc.array(editOpArb(maxUserIndex, maxSegIndex), {
                minLength: 1,
                maxLength: 20,
              }),
            );
          }),
        ),
        ([segmentCount, extraUserCount, editOps]) => {
          const { editService, authorizedUsers, transcriptionId } = setupServices(
            segmentCount,
            extraUserCount,
          );

          const beforeAll = new Date();

          // Apply all edits
          for (const op of editOps) {
            const user = authorizedUsers[op.userIndex];
            editService.editSegment(transcriptionId, op.segmentIndex, op.newText, user.id);
          }

          const afterAll = new Date();

          // Verify edit history
          const history = editService.getEditHistory(transcriptionId);
          expect(history).toHaveLength(editOps.length);

          for (let i = 0; i < editOps.length; i++) {
            const record = history[i];
            const op = editOps[i];
            const expectedUser = authorizedUsers[op.userIndex];

            // editedBy must match the user who performed the edit (Req 8.2)
            expect(record.editedBy).toBe(expectedUser.id);

            // editedAt must be a valid Date within the test window
            expect(record.editedAt).toBeInstanceOf(Date);
            expect(record.editedAt.getTime()).toBeGreaterThanOrEqual(beforeAll.getTime());
            expect(record.editedAt.getTime()).toBeLessThanOrEqual(afterAll.getTime());

            // newText must match what was requested
            expect(record.newText).toBe(op.newText);

            // transcriptionId must be correct
            expect(record.transcriptionId).toBe(transcriptionId);

            // segmentIndex must match
            expect(record.segmentIndex).toBe(op.segmentIndex);

            // id must be a non-empty string
            expect(record.id).toBeTruthy();
            expect(typeof record.id).toBe('string');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('transcription ownership is correctly associated via ownerId (Req 9.2)', () => {
    fc.assert(
      fc.property(
        segmentCountArb,
        extraUserCountArb,
        (segmentCount, extraUserCount) => {
          const { userService, owner, transcriptionId } = setupServices(
            segmentCount,
            extraUserCount,
          );

          // The owner must have read-write permission (implicit ownership)
          const ownerPermission = userService.getPermission(owner.id, transcriptionId);
          expect(ownerPermission).toBe('read-write');

          // The owner must be able to view the transcription
          expect(userService.canViewTranscription(owner.id, transcriptionId)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('edit records preserve chronological order of editedAt timestamps', () => {
    fc.assert(
      fc.property(
        segmentCountArb.chain((segCount) =>
          extraUserCountArb.chain((extraCount) => {
            const maxUserIndex = extraCount;
            const maxSegIndex = segCount - 1;
            return fc.tuple(
              fc.constant(segCount),
              fc.constant(extraCount),
              fc.array(editOpArb(maxUserIndex, maxSegIndex), {
                minLength: 2,
                maxLength: 15,
              }),
            );
          }),
        ),
        ([segmentCount, extraUserCount, editOps]) => {
          const { editService, authorizedUsers, transcriptionId } = setupServices(
            segmentCount,
            extraUserCount,
          );

          for (const op of editOps) {
            const user = authorizedUsers[op.userIndex];
            editService.editSegment(transcriptionId, op.segmentIndex, op.newText, user.id);
          }

          const history = editService.getEditHistory(transcriptionId);

          // Timestamps must be in non-decreasing order
          for (let i = 1; i < history.length; i++) {
            expect(history[i].editedAt.getTime()).toBeGreaterThanOrEqual(
              history[i - 1].editedAt.getTime(),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
