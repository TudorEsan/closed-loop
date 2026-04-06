export type EventStatus = 'draft' | 'setup' | 'active' | 'settlement' | 'closed';

export type Event = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizerId: string;
  status: EventStatus;
  currency: string;
  tokenCurrencyRate: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateEventDto = {
  name: string;
  description?: string;
  currency?: string;
  tokenCurrencyRate: number;
  startDate: string;
  endDate: string;
  timezone?: string;
  location?: string;
};

export type EventQuery = {
  status?: EventStatus;
  search?: string;
  limit?: number;
  cursor?: string;
};

export type PaginatedEvents = {
  events: Event[];
  nextCursor: string | null;
};

export type EventMemberRole = 'organizer' | 'admin' | 'operator';

export type EventMember = {
  id: string;
  eventId: string;
  userId: string;
  role: EventMemberRole;
  invitedBy: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
};
