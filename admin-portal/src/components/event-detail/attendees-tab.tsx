import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  MailIcon,
  TicketIcon,
  XIcon,
} from 'lucide-react';

import { ticketsService } from '@/services';
import type { TicketStatus } from '@/types';
import { TICKET_STATUS_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

const ticketBadge = (status: TicketStatus) => {
  switch (status) {
    case 'pending':
      return 'secondary' as const;
    case 'redeemed':
      return 'default' as const;
    case 'revoked':
    case 'expired':
      return 'destructive' as const;
  }
};

export function AttendeesTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ['events', eventId, 'tickets'],
    queryFn: () => ticketsService.list(eventId).then((r) => r.data.tickets),
  });

  const tickets = ticketsQuery.data ?? [];
  const pendingTickets = tickets.filter((t) => t.status === 'pending').length;
  const redeemedTickets = tickets.filter((t) => t.status === 'redeemed').length;

  const revokeTicket = useMutation({
    mutationFn: (ticketId: string) => ticketsService.revoke(eventId, ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'tickets'],
      });
      toast.success('Invite revoked');
    },
    onError: (err) => toast.error(extractApiMessage(err) ?? 'Revoke failed'),
  });

  return (
    <div className="space-y-8">
      <SendTicketForm eventId={eventId} />

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Invites</h3>
            <p className="text-sm text-muted-foreground">
              {pendingTickets} pending, {redeemedTickets} redeemed,{' '}
              {tickets.length} total
            </p>
          </div>
        </header>

        {ticketsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <TicketIcon className="size-9 text-muted-foreground/40" />
              <h3 className="mt-3 text-sm font-medium">No invites yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite an attendee with the form above. They get an email with
                a QR code that the operator scans at the gate.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t">
                    <td className="truncate px-3 py-2">{ticket.email}</td>
                    <td className="px-3 py-2">
                      <Badge variant={ticketBadge(ticket.status)}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {ticket.sentAt
                        ? new Date(ticket.sentAt).toLocaleDateString()
                        : ticket.status === 'pending'
                          ? 'Sending'
                          : 'Not sent'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {ticket.status === 'pending' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeTicket.mutate(ticket.id)}
                          disabled={revokeTicket.isPending}
                        >
                          <XIcon className="size-3.5" />
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type SendTicketFormValues = {
  email: string;
  name: string;
};

function SendTicketForm({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendTicketFormValues>({
    defaultValues: { email: '', name: '' },
  });

  const issueMutation = useMutation({
    mutationFn: (values: SendTicketFormValues) =>
      ticketsService.issue(eventId, {
        email: values.email.trim(),
        name: values.name.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'tickets'],
      });
      toast.success('Invite sent');
      reset({ email: '', name: '' });
    },
    onError: (err) => {
      setServerError(extractApiMessage(err) ?? 'Failed to send invite');
    },
  });

  const onSubmit = (values: SendTicketFormValues) => {
    setServerError(null);
    issueMutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailIcon className="size-4" />
          Invite an attendee
        </CardTitle>
        <CardDescription>
          The recipient gets an email with a QR code. They show it at the gate
          and the operator scans it to bind their wristband.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end"
        >
          <FieldGroup className="md:col-span-1">
            <Field>
              <FieldLabel htmlFor="ticket-email">Email</FieldLabel>
              <Input
                id="ticket-email"
                type="email"
                placeholder="attendee@example.com"
                autoComplete="off"
                spellCheck={false}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /[^\s@]+@[^\s@]+\.[^\s@]+/,
                    message: 'Enter a valid email',
                  },
                })}
              />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ticket-name">Name (optional)</FieldLabel>
              <Input id="ticket-name" {...register('name')} />
            </Field>
          </FieldGroup>
          <Button
            type="submit"
            disabled={issueMutation.isPending}
            className="md:self-end"
          >
            {issueMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Send invite
          </Button>
        </form>
        {serverError && (
          <p className="mt-3 text-sm text-destructive">{serverError}</p>
        )}
      </CardContent>
    </Card>
  );
}

function extractApiMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const maybe = err as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = maybe.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? null;
}
