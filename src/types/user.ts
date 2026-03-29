/**
 * Types for user management, permissions, editing, and sharing.
 * Used by UserService and EditService.
 */

export type Permission = 'read' | 'read-write';

export interface EditRecord {
  id: string;
  transcriptionId: string;
  segmentIndex: number;
  previousText: string;
  newText: string;
  editedBy: string;    // userId
  editedAt: Date;
}

export interface TranscriptionShare {
  id: string;
  transcriptionId: string;
  sharedByUserId: string;
  sharedWithUserId: string;
  permission: Permission;
  sharedAt: Date;
}
