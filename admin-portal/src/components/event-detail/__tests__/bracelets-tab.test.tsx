import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BraceletsTab } from '@/components/event-detail/bracelets-tab';
import {
  braceletStore,
  makeBracelet,
  makeUser,
  resetBraceletStore,
} from '@/test/mocks/bracelet-handlers';
import { server } from '@/test/mocks/server';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';

const API = 'http://localhost:3000/api/v1';
const EVENT_ID = 'evt_123';

beforeEach(() => {
  resetBraceletStore();
});

afterEach(() => {
  resetBraceletStore();
});

describe('BraceletsTab', () => {
  it('BraceletsTab, on mount with no bracelets, shows the empty state and a Link Bracelet CTA', async () => {
    renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    expect(await screen.findByText(/no bracelets linked yet/i)).toBeInTheDocument();

    const links = screen.getAllByRole('button', { name: /link bracelet/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/0 active, 0 total/i)).toBeInTheDocument();
  });

  it('BraceletsTab, on mount with bracelets, shows the list and the active count', async () => {
    const userA = makeUser({ name: 'Ada Lovelace' });
    const userB = makeUser({ name: 'Grace Hopper' });
    braceletStore.bracelets.push(
      makeBracelet({ wristbandUid: '04:AA:BB:CC:DD:EE:FF', status: 'active' }, userA),
      makeBracelet({ wristbandUid: '04:11:22:33:44:55:66', status: 'revoked' }, userB),
    );

    renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('04:AA:BB:CC:DD:EE:FF')).toBeInTheDocument();
    expect(screen.getByText(/1 active, 2 total/i)).toBeInTheDocument();
  });

  it('LinkBraceletDialog (via Link Bracelet button), when admin selects an attendee and submits a valid UID, posts to /events/:eventId/bracelets and closes', async () => {
    const attendee = makeUser({ name: 'Alan Turing', email: 'alan@example.com' });
    braceletStore.users.push(attendee);

    const { user } = renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    await screen.findByText(/no bracelets linked yet/i);
    await user.click(screen.getAllByRole('button', { name: /link bracelet/i })[0]);

    const dialog = await screen.findByRole('dialog', { name: /link a bracelet/i });

    await user.type(within(dialog).getByLabelText(/attendee/i), 'Alan');

    const candidate = await within(dialog).findByText('Alan Turing');
    await user.click(candidate);

    await user.type(within(dialog).getByLabelText(/wristband uid/i), '04:AA:BB:CC:DD:EE:F0');

    await user.click(within(dialog).getByRole('button', { name: /^link bracelet$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /link a bracelet/i })).not.toBeInTheDocument();
    });

    expect(await screen.findByText('Alan Turing')).toBeInTheDocument();
    expect(screen.getByText('04:AA:BB:CC:DD:EE:F0')).toBeInTheDocument();
  });

  it('LinkBraceletDialog, when API returns 409, shows the server error inline and keeps the dialog open', async () => {
    const attendee = makeUser({ name: 'Linus Torvalds' });
    braceletStore.users.push(attendee);

    server.use(
      http.post(`${API}/events/:eventId/bracelets`, () =>
        HttpResponse.json({ message: 'Wristband already linked' }, { status: 409 }),
      ),
    );

    const { user } = renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    await screen.findByText(/no bracelets linked yet/i);
    await user.click(screen.getAllByRole('button', { name: /link bracelet/i })[0]);

    const dialog = await screen.findByRole('dialog', { name: /link a bracelet/i });

    await user.type(within(dialog).getByLabelText(/attendee/i), 'Linus');
    await user.click(await within(dialog).findByText('Linus Torvalds'));

    await user.type(within(dialog).getByLabelText(/wristband uid/i), '04:DE:AD:BE:EF:00:11');
    await user.click(within(dialog).getByRole('button', { name: /^link bracelet$/i }));

    expect(await within(dialog).findByText(/wristband already linked/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /link a bracelet/i })).toBeInTheDocument();
  });

  it('LinkBraceletDialog, when UID format is invalid, shows a client-side validation error and does not POST', async () => {
    const attendee = makeUser({ name: 'Margaret Hamilton' });
    braceletStore.users.push(attendee);

    let postCalls = 0;
    server.use(
      http.post(`${API}/events/:eventId/bracelets`, () => {
        postCalls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { user } = renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    await screen.findByText(/no bracelets linked yet/i);
    await user.click(screen.getAllByRole('button', { name: /link bracelet/i })[0]);

    const dialog = await screen.findByRole('dialog', { name: /link a bracelet/i });

    await user.type(within(dialog).getByLabelText(/attendee/i), 'Margaret');
    await user.click(await within(dialog).findByText('Margaret Hamilton'));

    await user.type(within(dialog).getByLabelText(/wristband uid/i), '!!');
    await user.click(within(dialog).getByRole('button', { name: /^link bracelet$/i }));

    expect(await within(dialog).findByText(/uid must be 4 to 64 chars/i)).toBeInTheDocument();
    expect(postCalls).toBe(0);
  });

  it('BraceletsTab, when user clicks Revoke and confirms, PATCHes the revoke endpoint and the row updates without a full reload', async () => {
    const owner = makeUser({ name: 'Donald Knuth' });
    const bracelet = makeBracelet(
      { wristbandUid: '04:KN:UT:H0:00:00:01', status: 'active' },
      owner,
    );
    braceletStore.bracelets.push(bracelet);

    const { user } = renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    expect(await screen.findByText('Donald Knuth')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    const menuTrigger = document.querySelector('button[aria-haspopup="menu"]');
    expect(menuTrigger).not.toBeNull();
    await user.click(menuTrigger as HTMLElement);

    await user.click(await screen.findByRole('menuitem', { name: /revoke/i }));

    const dialog = await screen.findByRole('dialog', { name: /revoke bracelet/i });

    await user.type(within(dialog).getByLabelText(/reason/i), 'Lost at gate');

    await user.click(within(dialog).getByRole('button', { name: /^revoke$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /revoke bracelet/i })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Revoked').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.getByText(/0 active, 1 total/i)).toBeInTheDocument();
  });

  it('BraceletsTab, when user clicks Replace and submits a new UID, POSTs to /replace and the new UID appears', async () => {
    const owner = makeUser({ name: 'Barbara Liskov' });
    const bracelet = makeBracelet(
      { wristbandUid: '04:OL:D0:00:00:00:00', status: 'active' },
      owner,
    );
    braceletStore.bracelets.push(bracelet);

    const { user } = renderWithProviders(<BraceletsTab eventId={EVENT_ID} />);

    expect(await screen.findByText('Barbara Liskov')).toBeInTheDocument();

    const menuTrigger = document.querySelector('button[aria-haspopup="menu"]');
    expect(menuTrigger).not.toBeNull();
    await user.click(menuTrigger as HTMLElement);

    await user.click(await screen.findByRole('menuitem', { name: /replace bracelet/i }));

    const dialog = await screen.findByRole('dialog', { name: /replace bracelet/i });

    await user.type(within(dialog).getByLabelText(/new wristband uid/i), '04:NE:W0:00:00:00:01');

    await user.click(within(dialog).getByRole('button', { name: /^replace$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /replace bracelet/i })).not.toBeInTheDocument();
    });

    expect(await screen.findByText('04:NE:W0:00:00:00:01')).toBeInTheDocument();
    expect(screen.getByText('04:OL:D0:00:00:00:00')).toBeInTheDocument();
    expect(screen.getAllByText('Replaced').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 active, 2 total/i)).toBeInTheDocument();
  });
});
