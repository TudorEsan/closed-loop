export type TicketStatus = 'pending' | 'redeemed' | 'revoked' | 'expired';

export type Ticket = {
  id: string;
  eventId: string;
  email: string;
  status: TicketStatus;
  issuedAt: string;
  sentAt: string | null;
  expiresAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
};

export type IssueTicketDto = {
  email: string;
  name?: string;
};

export type ListTicketsResponse = {
  tickets: Ticket[];
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'Pending',
  redeemed: 'Redeemed',
  revoked: 'Revoked',
  expired: 'Expired',
};
