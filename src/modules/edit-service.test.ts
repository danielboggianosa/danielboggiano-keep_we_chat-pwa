import { describe, it, expect, beforeEach } from 'vitest';
import { EditService } from './edit-service';
import { UserService } from './user-service';
import type { User } from './user-service';

describe('EditService', () => {
  let userService: UserService;
  let editService: EditService;
  let owner: User;
  let editorUser: User;
  let readerUser: User;
  let noAccessUser: User;

  beforeEach(() => {
    userService = new UserService();
    editService = new EditService(userService);

    owner = { id: 'owner-1', role: 'user', isActive: true };
    editorUser = { id: 'editor-1', role: 'user', isActive: true };
    readerUser = { id: 'reader-1', role: 'user', isActive: true };
    noAccessUser = { id: 'no-access-1', role: 'user', isActive: true };

    userService.addUser(owner);
    userService.addUser(editorUser);
    userService.addUser(readerUser);
    userService.addUser(noAccessUser);

    // Register transcription owned by owner
    userService.registerTranscription('t-1', 'owner-1');
    // Share with editor (read-write) and reader (read)
    userService.shareTranscription('owner-1', 't-1', 'editor-1', 'read-write');
    userService.shareTranscription('owner-1', 't-1', 'reader-1', 'read');

    // Register segments for the transcription
    editService.registerSegments('t-1', ['Hello world', 'Second segment', 'Third segment']);
  });

  // ─── Permission enforcement (Req 8.1) ───

  describe('permission enforcement', () => {
    it('should reject edit from user with read-only permission (Req 8.1)', () => {
      expect(() =>
        editService.editSegment('t-1', 0, 'Modified text', 'reader-1'),
      ).toThrow('does not have edit permission');
    });

    it('should reject edit from user with no access (Req 8.1)', () => {
      expect(() =>
        editService.editSegment('t-1', 0, 'Modified text', 'no-access-1'),
      ).toThrow('does not have edit permission');
    });

    it('should allow the owner to edit (Req 8.1)', () => {
      expect(() =>
        editService.editSegment('t-1', 0, 'Owner edit', 'owner-1'),
      ).not.toThrow();
    });

    it('should allow a user with read-write permission to edit (Req 8.1)', () => {
      expect(() =>
        editService.editSegment('t-1', 0, 'Editor edit', 'editor-1'),
      ).not.toThrow();
    });
  });

  // ─── EditRecord creation (Req 8.2) ───

  describe('edit creates EditRecord', () => {
    it('should create an EditRecord with correct editedBy and editedAt', () => {
      const before = new Date();
      editService.editSegment('t-1', 0, 'Updated text', 'owner-1');
      const after = new Date();

      const history = editService.getEditHistory('t-1');
      expect(history).toHaveLength(1);

      const record = history[0];
      expect(record.transcriptionId).toBe('t-1');
      expect(record.segmentIndex).toBe(0);
      expect(record.previousText).toBe('Hello world');
      expect(record.newText).toBe('Updated text');
      expect(record.editedBy).toBe('owner-1');
      expect(record.editedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(record.editedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should preserve previousText from before the edit', () => {
      editService.editSegment('t-1', 1, 'First edit', 'owner-1');
      editService.editSegment('t-1', 1, 'Second edit', 'owner-1');

      const history = editService.getEditHistory('t-1');
      expect(history).toHaveLength(2);
      expect(history[0].previousText).toBe('Second segment');
      expect(history[0].newText).toBe('First edit');
      expect(history[1].previousText).toBe('First edit');
      expect(history[1].newText).toBe('Second edit');
    });
  });

  // ─── getEditHistory (Req 8.3) ───

  describe('getEditHistory', () => {
    it('should return all edits for a transcription', () => {
      editService.editSegment('t-1', 0, 'Edit A', 'owner-1');
      editService.editSegment('t-1', 1, 'Edit B', 'editor-1');
      editService.editSegment('t-1', 2, 'Edit C', 'owner-1');

      const history = editService.getEditHistory('t-1');
      expect(history).toHaveLength(3);
      expect(history[0].newText).toBe('Edit A');
      expect(history[1].newText).toBe('Edit B');
      expect(history[2].newText).toBe('Edit C');
    });

    it('should return empty array for transcription with no edits', () => {
      const history = editService.getEditHistory('t-nonexistent');
      expect(history).toHaveLength(0);
    });

    it('should not mix edit histories across transcriptions', () => {
      userService.registerTranscription('t-2', 'owner-1');
      editService.registerSegments('t-2', ['Segment A']);

      editService.editSegment('t-1', 0, 'Edit on t-1', 'owner-1');
      editService.editSegment('t-2', 0, 'Edit on t-2', 'owner-1');

      expect(editService.getEditHistory('t-1')).toHaveLength(1);
      expect(editService.getEditHistory('t-2')).toHaveLength(1);
      expect(editService.getEditHistory('t-1')[0].transcriptionId).toBe('t-1');
      expect(editService.getEditHistory('t-2')[0].transcriptionId).toBe('t-2');
    });
  });

  // ─── Edge cases ───

  describe('edge cases', () => {
    it('should throw for out-of-bounds segment index', () => {
      expect(() =>
        editService.editSegment('t-1', 99, 'Bad index', 'owner-1'),
      ).toThrow('out of bounds');
    });

    it('should throw for non-existent transcription segments', () => {
      userService.registerTranscription('t-empty', 'owner-1');
      expect(() =>
        editService.editSegment('t-empty', 0, 'No segments', 'owner-1'),
      ).toThrow('no registered segments');
    });
  });
});
