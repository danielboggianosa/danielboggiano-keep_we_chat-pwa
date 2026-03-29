/**
 * Feature: meeting-transcription, Property 9: Enforcement de permisos de edición
 *
 * **Validates: Requirements 8.1**
 *
 * Property: For every edit attempt on a transcription, the operation must succeed
 * only if the user is the owner or has 'read-write' permission via a TranscriptionShare.
 * Any other attempt (read-only, no access) must be rejected.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EditService } from '../edit-service';
import { UserService } from '../user-service';
import type { User } from '../user-service';
import type { Permission } from '../../types/user';

// ── Types ─────────────────────────────────────────────────────────

type PermissionLevel = 'owner' | 'read-write' | 'read' | 'no-access';

interface EditAttempt {
  permissionLevel: PermissionLevel;
  segmentIndex: number;
  newText: string;
}

// ── Arbitraries ───────────────────────────────────────────────────

const permissionLevelArb: fc.Arbitrary<PermissionLevel> = fc.constantFrom(
  'owner',
  'read-write',
  'read',
  'no-access',
);

const segmentTextArb: fc.Arbitrary<string> = fc.stringOf(
  fc.char().filter((c) => c.length > 0 && c !== '\0'),
  { minLength: 1, maxLength: 50 },
);

const segmentCountArb = fc.integer({ min: 1, max: 10 });

const editAttemptArb = (maxSegmentIndex: number): fc.Arbitrary<EditAttempt> =>
  fc.record({
    permissionLevel: permissionLevelArb,
    segmentIndex: fc.integer({ min: 0, max: maxSegmentIndex }),
    newText: segmentTextArb,
  });

// ── Helpers ───────────────────────────────────────────────────────

function setupServices(
  segmentCount: number,
): {
  editService: EditService;
  userService: UserService;
  owner: User;
  rwUser: User;
  readUser: User;
  noAccessUser: User;
  transcriptionId: string;
} {
  const userService = new UserService();
  const editService = new EditService(userService);

  const owner: User = { id: 'owner-1', role: 'user', isActive: true };
  const rwUser: User = { id: 'rw-user-1', role: 'user', isActive: true };
  const readUser: User = { id: 'read-user-1', role: 'user', isActive: true };
  const noAccessUser: User = { id: 'no-access-1', role: 'user', isActive: true };

  userService.addUser(owner);
  userService.addUser(rwUser);
  userService.addUser(readUser);
  userService.addUser(noAccessUser);

  const transcriptionId = 'transcription-1';
  userService.registerTranscription(transcriptionId, owner.id);
  userService.shareTranscription(owner.id, transcriptionId, rwUser.id, 'read-write');
  userService.shareTranscription(owner.id, transcriptionId, readUser.id, 'read');

  const segments = Array.from({ length: segmentCount }, (_, i) => `Segment ${i}`);
  editService.registerSegments(transcriptionId, segments);

  return { editService, userService, owner, rwUser, readUser, noAccessUser, transcriptionId };
}

function getUserIdForLevel(
  level: PermissionLevel,
  owner: User,
  rwUser: User,
  readUser: User,
  noAccessUser: User,
): string {
  switch (level) {
    case 'owner':
      return owner.id;
    case 'read-write':
      return rwUser.id;
    case 'read':
      return readUser.id;
    case 'no-access':
      return noAccessUser.id;
  }
}

// ── Property tests ────────────────────────────────────────────────

describe('Property 9: Enforcement de permisos de edición', () => {
  it('only owner or read-write users can edit; read and no-access are rejected', () => {
    fc.assert(
      fc.property(
        segmentCountArb.chain((count) =>
          fc.tuple(fc.constant(count), editAttemptArb(count - 1)),
        ),
        ([segmentCount, attempt]) => {
          const { editService, owner, rwUser, readUser, noAccessUser, transcriptionId } =
            setupServices(segmentCount);

          const userId = getUserIdForLevel(
            attempt.permissionLevel,
            owner,
            rwUser,
            readUser,
            noAccessUser,
          );

          const shouldSucceed =
            attempt.permissionLevel === 'owner' || attempt.permissionLevel === 'read-write';

          if (shouldSucceed) {
            expect(() =>
              editService.editSegment(
                transcriptionId,
                attempt.segmentIndex,
                attempt.newText,
                userId,
              ),
            ).not.toThrow();
          } else {
            expect(() =>
              editService.editSegment(
                transcriptionId,
                attempt.segmentIndex,
                attempt.newText,
                userId,
              ),
            ).toThrow('does not have edit permission');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('multiple edit attempts with random permission combinations are correctly enforced', () => {
    fc.assert(
      fc.property(
        segmentCountArb.chain((count) =>
          fc.tuple(
            fc.constant(count),
            fc.array(editAttemptArb(count - 1), { minLength: 1, maxLength: 20 }),
          ),
        ),
        ([segmentCount, attempts]) => {
          const { editService, owner, rwUser, readUser, noAccessUser, transcriptionId } =
            setupServices(segmentCount);

          for (const attempt of attempts) {
            const userId = getUserIdForLevel(
              attempt.permissionLevel,
              owner,
              rwUser,
              readUser,
              noAccessUser,
            );

            const shouldSucceed =
              attempt.permissionLevel === 'owner' || attempt.permissionLevel === 'read-write';

            if (shouldSucceed) {
              expect(() =>
                editService.editSegment(
                  transcriptionId,
                  attempt.segmentIndex,
                  attempt.newText,
                  userId,
                ),
              ).not.toThrow();
            } else {
              expect(() =>
                editService.editSegment(
                  transcriptionId,
                  attempt.segmentIndex,
                  attempt.newText,
                  userId,
                ),
              ).toThrow('does not have edit permission');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
