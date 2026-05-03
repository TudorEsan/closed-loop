import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Pencil, Trash2 } from 'lucide-react';

import type { EventStatus } from '@/types';
import { eventsService, ticketsService, vendorsService } from '@/services';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AttendeesTab } from '@/components/event-detail/attendees-tab';
import { BraceletsTab } from '@/components/event-detail/bracelets-tab';
import { DeleteEventDialog } from '@/components/event-detail/delete-event-dialog';
import { EditEventDialog } from '@/components/event-detail/edit-event-dialog';
import { EventStatsCards } from '@/components/event-detail/event-stats-cards';
import {
  STATUS_BADGE_CONFIG,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from '@/components/event-detail/helpers';
import { OverviewTab } from '@/components/event-detail/overview-tab';
import { TeamTab } from '@/components/event-detail/team-tab';
import { TransactionChart } from '@/components/event-detail/transaction-chart';
import { VendorsTab } from '@/components/event-detail/vendors-tab';

function EventDetailSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    </>
  );
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: event,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsService.getById(eventId!).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: vendorData } = useQuery({
    queryKey: ['events', eventId, 'vendors'],
    queryFn: () => vendorsService.list(eventId!).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: transactionSummary } = useQuery({
    queryKey: ['events', eventId, 'transactions', 'summary'],
    queryFn: () =>
      eventsService.getTransactionSummary(eventId!).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: members } = useQuery({
    queryKey: ['events', eventId, 'members'],
    queryFn: () => eventsService.listMembers(eventId!).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: tickets } = useQuery({
    queryKey: ['events', eventId, 'tickets'],
    queryFn: () => ticketsService.list(eventId!).then((r) => r.data.tickets),
    enabled: !!eventId,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: EventStatus) =>
      eventsService.updateStatus(eventId!, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success('Event status updated');
    },
    onError: () => {
      toast.error('Failed to update event status');
    },
  });

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  if (isError || !event) {
    return (
      <div className="px-4 lg:px-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">Could not load event details.</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const nextStatus = STATUS_TRANSITIONS[event.status];
  const badgeConfig = STATUS_BADGE_CONFIG[event.status];
  const vendorCount = vendorData?.vendors?.length ?? 0;
  const memberCount = members?.length ?? 0;
  const pendingInviteCount =
    tickets?.filter((t) => t.status === 'pending').length ?? 0;

  return (
    <>
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <Badge
            variant={badgeConfig.variant}
            className={badgeConfig.className}
          >
            {STATUS_LABELS[event.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {nextStatus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Status
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => statusMutation.mutate(nextStatus)}
                  disabled={statusMutation.isPending}
                >
                  Move to {STATUS_LABELS[nextStatus]}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <EventStatsCards
        event={event}
        summary={transactionSummary}
        vendorCount={vendorCount}
        memberCount={memberCount}
      />

      <div className="px-4 lg:px-6">
        <TransactionChart summary={transactionSummary} />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">
              Team
              {memberCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1.5 py-0 text-xs"
                >
                  {memberCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vendors">
              Vendors
              {vendorCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1.5 py-0 text-xs"
                >
                  {vendorCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attendees">
              Attendees
              {pendingInviteCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1.5 py-0 text-xs"
                >
                  {pendingInviteCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bracelets">Bracelets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab event={event} onEditClick={() => setEditOpen(true)} />
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <TeamTab eventId={event.id} />
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <VendorsTab eventId={event.id} />
          </TabsContent>

          <TabsContent value="attendees" className="mt-4">
            <AttendeesTab eventId={event.id} />
          </TabsContent>

          <TabsContent value="bracelets" className="mt-4">
            <BraceletsTab eventId={event.id} />
          </TabsContent>
        </Tabs>
      </div>

      <EditEventDialog
        event={event}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteEventDialog
        eventId={event.id}
        eventName={event.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
