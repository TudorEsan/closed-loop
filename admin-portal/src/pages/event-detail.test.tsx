import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventDetailPage } from './event-detail';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import type { Event, EventTransactionSummary } from '@/types';

const componentMocks = vi.hoisted(() => ({
  teamTab: vi.fn(),
  vendorsTab: vi.fn(),
  attendeesTab: vi.fn(),
  braceletsTab: vi.fn(),
  deleteEventDialog: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  eventsService: {
    getById: vi.fn(),
    getTransactionSummary: vi.fn(),
    listMembers: vi.fn(),
    updateStatus: vi.fn(),
  },
  vendorsService: {
    list: vi.fn(),
  },
  ticketsService: {
    list: vi.fn(),
  },
}));

vi.mock('@/services', () => serviceMocks);

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs">{children}</div>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-content">{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/components/event-detail/event-stats-cards', () => ({
  EventStatsCards: () => <div data-testid="event-stats-cards" />,
}));

vi.mock('@/components/event-detail/transaction-chart', () => ({
  TransactionChart: () => <div data-testid="transaction-chart" />,
}));

vi.mock('@/components/event-detail/overview-tab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}));

vi.mock('@/components/event-detail/edit-event-dialog', () => ({
  EditEventDialog: () => <div data-testid="edit-event-dialog" />,
}));

vi.mock('@/components/event-detail/delete-event-dialog', () => ({
  DeleteEventDialog: (props: { eventId: string }) => {
    componentMocks.deleteEventDialog(props);
    return <div data-testid="delete-event-dialog" />;
  },
}));

vi.mock('@/components/event-detail/team-tab', () => ({
  TeamTab: (props: { eventId: string }) => {
    componentMocks.teamTab(props);
    return <div data-testid="team-tab" />;
  },
}));

vi.mock('@/components/event-detail/vendors-tab', () => ({
  VendorsTab: (props: { eventId: string }) => {
    componentMocks.vendorsTab(props);
    return <div data-testid="vendors-tab" />;
  },
}));

vi.mock('@/components/event-detail/attendees-tab', () => ({
  AttendeesTab: (props: { eventId: string }) => {
    componentMocks.attendeesTab(props);
    return <div data-testid="attendees-tab" />;
  },
}));

vi.mock('@/components/event-detail/bracelets-tab', () => ({
  BraceletsTab: (props: { eventId: string }) => {
    componentMocks.braceletsTab(props);
    return <div data-testid="bracelets-tab" />;
  },
}));

const routeEventId = 'route-event-id';
const responseEventId = 'response-event-id';

const event: Event = {
  id: responseEventId,
  name: 'Festival',
  slug: 'festival',
  description: null,
  organizerId: 'organizer-id',
  status: 'draft',
  currency: 'RON',
  tokenCurrencyRate: '1',
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-06-02T00:00:00.000Z',
  timezone: 'Europe/Bucharest',
  location: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const summary: EventTransactionSummary = {
  salesVolume: 0,
  transactionCount: 0,
  currency: 'RON',
  buckets: [],
};

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/events/${routeEventId}`]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.eventsService.getById.mockResolvedValue({ data: event });
    serviceMocks.eventsService.getTransactionSummary.mockResolvedValue({
      data: summary,
    });
    serviceMocks.eventsService.listMembers.mockResolvedValue({ data: [] });
    serviceMocks.vendorsService.list.mockResolvedValue({
      data: { vendors: [], nextCursor: null },
    });
    serviceMocks.ticketsService.list.mockResolvedValue({
      data: { tickets: [] },
    });
  });

  it('uses the route event id for event-scoped reads', async () => {
    renderPage();

    await screen.findByText('Festival');

    expect(serviceMocks.eventsService.getById).toHaveBeenCalledWith(
      routeEventId,
    );
    expect(serviceMocks.vendorsService.list).toHaveBeenCalledWith(routeEventId);
    expect(
      serviceMocks.eventsService.getTransactionSummary,
    ).toHaveBeenCalledWith(routeEventId);
    expect(serviceMocks.eventsService.listMembers).toHaveBeenCalledWith(
      routeEventId,
    );
    expect(serviceMocks.ticketsService.list).toHaveBeenCalledWith(routeEventId);
  });

  it('passes the route event id to nested event tools', async () => {
    renderPage();

    await waitFor(() => {
      expect(componentMocks.deleteEventDialog).toHaveBeenCalled();
    });

    expect(componentMocks.teamTab).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: routeEventId }),
    );
    expect(componentMocks.vendorsTab).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: routeEventId }),
    );
    expect(componentMocks.attendeesTab).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: routeEventId }),
    );
    expect(componentMocks.braceletsTab).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: routeEventId }),
    );
    expect(componentMocks.deleteEventDialog).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: routeEventId }),
    );
  });
});
