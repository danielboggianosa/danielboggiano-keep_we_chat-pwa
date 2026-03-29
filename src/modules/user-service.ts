/**
 * UserService — Gestión de usuarios, control de acceso y compartición de transcripciones.
 * Almacenamiento in-memory con Maps (sin DB externa).
 *
 * Requisitos: 9.1, 9.2, 9.3, 9.4
 */

import type { Permission, TranscriptionShare } from '../types/user';

export interface User {
  id: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

export interface TranscriptionOwnership {
  transcriptionId: string;
  ownerId: string;
}

export class UserService {
  /** userId → User */
  private users: Map<string, User> = new Map();
  /** transcriptionId → ownerId */
  private transcriptionOwners: Map<string, string> = new Map();
  /** "transcriptionId:userId" → TranscriptionShare */
  private shares: Map<string, TranscriptionShare> = new Map();

  // ─── User management helpers ───

  addUser(user: User): void {
    this.users.set(user.id, { ...user });
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /** Register a transcription with its owner (Req 9.2) */
  registerTranscription(transcriptionId: string, ownerId: string): void {
    const owner = this.users.get(ownerId);
    if (!owner) {
      throw new Error(`User "${ownerId}" does not exist`);
    }
    if (!owner.isActive) {
      throw new Error(`User "${ownerId}" is not active`);
    }
    this.transcriptionOwners.set(transcriptionId, ownerId);
  }

  // ─── Access control (Req 9.1) ───

  /**
   * Admin grants access to a user.
   * Only an active admin can grant access.
   */
  grantAccess(adminId: string, userId: string): void {
    this.assertAdmin(adminId);
    const target = this.users.get(userId);
    if (!target) {
      throw new Error(`User "${userId}" does not exist`);
    }
    target.isActive = true;
  }

  /**
   * Admin revokes access from a user.
   * An admin cannot revoke their own access.
   */
  revokeAccess(adminId: string, userId: string): void {
    this.assertAdmin(adminId);
    if (adminId === userId) {
      throw new Error('An admin cannot revoke their own access');
    }
    const target = this.users.get(userId);
    if (!target) {
      throw new Error(`User "${userId}" does not exist`);
    }
    target.isActive = false;
  }

  /** Check whether a user currently has access (is active). */
  hasAccess(userId: string): boolean {
    const user = this.users.get(userId);
    return !!user && user.isActive;
  }

  // ─── Transcription sharing (Req 9.3, 9.4) ───

  /**
   * Owner shares a transcription with another user.
   * Only the transcription owner can share it.
   */
  shareTranscription(
    ownerId: string,
    transcriptionId: string,
    targetUserId: string,
    permission: Permission,
  ): void {
    const actualOwner = this.transcriptionOwners.get(transcriptionId);
    if (actualOwner === undefined) {
      throw new Error(`Transcription "${transcriptionId}" does not exist`);
    }
    if (actualOwner !== ownerId) {
      throw new Error(`User "${ownerId}" is not the owner of transcription "${transcriptionId}"`);
    }
    if (ownerId === targetUserId) {
      throw new Error('Cannot share a transcription with yourself');
    }
    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      throw new Error(`Target user "${targetUserId}" does not exist`);
    }

    const key = this.shareKey(transcriptionId, targetUserId);
    const share: TranscriptionShare = {
      id: `share-${transcriptionId}-${targetUserId}`,
      transcriptionId,
      sharedByUserId: ownerId,
      sharedWithUserId: targetUserId,
      permission,
      sharedAt: new Date(),
    };
    this.shares.set(key, share);
  }

  /**
   * Check if a user can view a transcription (Req 9.3).
   * Allowed when the user is the owner OR has a share entry.
   */
  canViewTranscription(userId: string, transcriptionId: string): boolean {
    const owner = this.transcriptionOwners.get(transcriptionId);
    if (owner === undefined) return false;
    if (owner === userId) return true;
    return this.shares.has(this.shareKey(transcriptionId, userId));
  }

  /**
   * Get the permission level a user has for a transcription.
   * Owner implicitly has 'read-write'. Shared users get their granted permission.
   * Returns undefined if the user has no access.
   */
  getPermission(userId: string, transcriptionId: string): Permission | undefined {
    const owner = this.transcriptionOwners.get(transcriptionId);
    if (owner === undefined) return undefined;
    if (owner === userId) return 'read-write';
    const share = this.shares.get(this.shareKey(transcriptionId, userId));
    return share?.permission;
  }

  // ─── Internal helpers ───

  private assertAdmin(adminId: string): void {
    const admin = this.users.get(adminId);
    if (!admin) {
      throw new Error(`User "${adminId}" does not exist`);
    }
    if (admin.role !== 'admin') {
      throw new Error(`User "${adminId}" is not an admin`);
    }
    if (!admin.isActive) {
      throw new Error(`Admin "${adminId}" is not active`);
    }
  }

  private shareKey(transcriptionId: string, userId: string): string {
    return `${transcriptionId}:${userId}`;
  }
}
