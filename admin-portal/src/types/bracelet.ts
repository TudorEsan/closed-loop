import type { User } from './user';

export type BraceletStatus = 'active' | 'revoked' | 'replaced';

export type BraceletAssignment = {
  id: string;
  eventId: string;
  userId: string;
  wristbandUid: string;
  status: BraceletStatus;
  linkedAt: string;
  linkedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  replacedByAssignmentId: string | null;
  tokenIssuedAt: string;
  tokenExpiresAt: string;
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
  token?: string | null;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
};

export type LinkBraceletDto = {
  userId: string;
  wristbandUid: string;
};

export type RevokeBraceletDto = {
  reason?: string;
};

export type ReplaceBraceletDto = {
  wristbandUid: string;
  reason?: string;
};

export type BraceletQuery = {
  status?: BraceletStatus;
  search?: string;
  limit?: number;
  cursor?: string;
};

export type PaginatedBracelets = {
  bracelets: BraceletAssignment[];
  nextCursor: string | null;
};

export const BRACELET_STATUS_LABELS: Record<BraceletStatus, string> = {
  active: 'Active',
  revoked: 'Revoked',
  replaced: 'Replaced',
};
