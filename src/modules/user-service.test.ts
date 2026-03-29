import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './user-service';
import type { User } from './user-service';

describe('UserService', () => {
  let service: UserService;
  let admin: User;
  let userA: User;
  let userB: User;

  beforeEach(() => {
    service = new UserService();
    admin = { id: 'admin-1', role: 'admin', isActive: true };
    userA = { id: 'user-a', role: 'user', isActive: true };
    userB = { id: 'user-b', role: 'user', isActive: true };
    service.addUser(admin);
    service.addUser(userA);
    service.addUser(userB);
  });

  // ─── grantAccess / revokeAccess (Req 9.1) ───

  describe('grantAccess', () => {
    it('should activate an inactive user when called by admin', () => {
      service.revokeAccess('admin-1', 'user-a');
      expect(service.hasAccess('user-a')).toBe(false);

      service.grantAccess('admin-1', 'user-a');
      expect(service.hasAccess('user-a')).toBe(true);
    });

    it('should throw when a non-admin tries to grant access', () => {
      expect(() => service.grantAccess('user-a', 'user-b')).toThrow('not an admin');
    });

    it('should throw when granting access to a non-existent user', () => {
      expect(() => service.grantAccess('admin-1', 'ghost')).toThrow('does not exist');
    });
  });

  describe('revokeAccess', () => {
    it('should deactivate a user when called by admin', () => {
      service.revokeAccess('admin-1', 'user-a');
      expect(service.hasAccess('user-a')).toBe(false);
    });

    it('should throw when admin tries to revoke their own access', () => {
      expect(() => service.revokeAccess('admin-1', 'admin-1')).toThrow('own access');
    });

    it('should throw when a non-admin tries to revoke access', () => {
      expect(() => service.revokeAccess('user-a', 'user-b')).toThrow('not an admin');
    });
  });

  describe('grant then revoke results in no access (Req 9.1)', () => {
    it('should deny access after grant followed by revoke', () => {
      const inactive: User = { id: 'user-c', role: 'user', isActive: false };
      service.addUser(inactive);

      service.grantAccess('admin-1', 'user-c');
      expect(service.hasAccess('user-c')).toBe(true);

      service.revokeAccess('admin-1', 'user-c');
      expect(service.hasAccess('user-c')).toBe(false);
    });
  });

  // ─── Transcription ownership (Req 9.2) ───

  describe('registerTranscription', () => {
    it('should associate a transcription with its creator', () => {
      service.registerTranscription('t-1', 'user-a');
      expect(service.canViewTranscription('user-a', 't-1')).toBe(true);
      expect(service.getPermission('user-a', 't-1')).toBe('read-write');
    });

    it('should throw when registering for a non-existent user', () => {
      expect(() => service.registerTranscription('t-1', 'ghost')).toThrow('does not exist');
    });
  });

  // ─── Visibility restriction (Req 9.3) ───

  describe('canViewTranscription', () => {
    it('should allow the owner to view their transcription', () => {
      service.registerTranscription('t-1', 'user-a');
      expect(service.canViewTranscription('user-a', 't-1')).toBe(true);
    });

    it('should deny access to a user without a share', () => {
      service.registerTranscription('t-1', 'user-a');
      expect(service.canViewTranscription('user-b', 't-1')).toBe(false);
    });

    it('should return false for a non-existent transcription', () => {
      expect(service.canViewTranscription('user-a', 'nope')).toBe(false);
    });
  });

  // ─── shareTranscription with read and read-write (Req 9.4) ───

  describe('shareTranscription', () => {
    beforeEach(() => {
      service.registerTranscription('t-1', 'user-a');
    });

    it('should share a transcription with read permission', () => {
      service.shareTranscription('user-a', 't-1', 'user-b', 'read');

      expect(service.canViewTranscription('user-b', 't-1')).toBe(true);
      expect(service.getPermission('user-b', 't-1')).toBe('read');
    });

    it('should share a transcription with read-write permission', () => {
      service.shareTranscription('user-a', 't-1', 'user-b', 'read-write');

      expect(service.canViewTranscription('user-b', 't-1')).toBe(true);
      expect(service.getPermission('user-b', 't-1')).toBe('read-write');
    });

    it('should allow updating permission from read to read-write', () => {
      service.shareTranscription('user-a', 't-1', 'user-b', 'read');
      expect(service.getPermission('user-b', 't-1')).toBe('read');

      service.shareTranscription('user-a', 't-1', 'user-b', 'read-write');
      expect(service.getPermission('user-b', 't-1')).toBe('read-write');
    });

    it('should throw when a non-owner tries to share', () => {
      expect(() =>
        service.shareTranscription('user-b', 't-1', 'admin-1', 'read'),
      ).toThrow('not the owner');
    });

    it('should throw when sharing with yourself', () => {
      expect(() =>
        service.shareTranscription('user-a', 't-1', 'user-a', 'read'),
      ).toThrow('yourself');
    });

    it('should throw when sharing a non-existent transcription', () => {
      expect(() =>
        service.shareTranscription('user-a', 'nope', 'user-b', 'read'),
      ).toThrow('does not exist');
    });

    it('should throw when sharing with a non-existent user', () => {
      expect(() =>
        service.shareTranscription('user-a', 't-1', 'ghost', 'read'),
      ).toThrow('does not exist');
    });
  });

  // ─── getPermission (Req 9.3, 9.4) ───

  describe('getPermission', () => {
    it('should return read-write for the owner', () => {
      service.registerTranscription('t-1', 'user-a');
      expect(service.getPermission('user-a', 't-1')).toBe('read-write');
    });

    it('should return undefined for a user with no access', () => {
      service.registerTranscription('t-1', 'user-a');
      expect(service.getPermission('user-b', 't-1')).toBeUndefined();
    });

    it('should return undefined for a non-existent transcription', () => {
      expect(service.getPermission('user-a', 'nope')).toBeUndefined();
    });
  });
});
