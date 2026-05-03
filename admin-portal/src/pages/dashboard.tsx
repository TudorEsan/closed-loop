import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PlusIcon,
  SearchIcon,
  Loader2,
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
} from 'lucide-react';

import { eventsService } from '@/services/events.service';
import type { EventStatus, EventQuery, CreateEventDto } from '@/types';

import { SectionCards } from '@/components/section-cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  EventStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  setup: {
    label: 'Setup',
    variant: 'outline',
    className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  },
  active: {
    label: 'Active',
    variant: 'default',
    className: 'bg-emerald-600 text-white',
  },
  settlement: {
    label: 'Settlement',
    variant: 'outline',
    className: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  },
  closed: { label: 'Closed', variant: 'destructive' },
};

function StatusBadge({ status }: { status: EventStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Create Event Dialog
// ---------------------------------------------------------------------------

type CreateEventFormValues = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
};

const EVENT_CURRENCY = 'EUR';
const TOKEN_CURRENCY_RATE = 1;

function CreateEventDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEventFormValues>({
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEventDto) => eventsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to create event. Please try again.');
    },
  });

  function onSubmit(values: CreateEventFormValues) {
    const dto: CreateEventDto = {
      name: values.name,
      currency: EVENT_CURRENCY,
      tokenCurrencyRate: TOKEN_CURRENCY_RATE,
      startDate: new Date(values.startDate).toISOString(),
      endDate: new Date(values.endDate).toISOString(),
    };

    if (values.description) dto.description = values.description;
    if (values.location) dto.location = values.location;
    if (values.timezone) dto.timezone = values.timezone;
    createMutation.mutate(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Fill in the details to set up a new event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Event Name *</FieldLabel>
              <Input
                id="name"
                placeholder="Summer Festival 2026"
                aria-invalid={!!errors.name}
                {...register('name', { required: 'Event name is required' })}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input id="description" placeholder="Short description of the event" {...register('description')} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input
                  id="startDate"
                  type="datetime-local"
                  aria-invalid={!!errors.startDate}
                  {...register('startDate', { required: 'Start date is required' })}
                />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date *</FieldLabel>
                <Input
                  id="endDate"
                  type="datetime-local"
                  aria-invalid={!!errors.endDate}
                  {...register('endDate', { required: 'End date is required' })}
                />
                {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <Input id="location" placeholder="Cluj-Napoca, Romania" {...register('location')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                <Input id="timezone" placeholder="Europe/Bucharest" {...register('timezone')} />
              </Field>
            </div>

          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: { id: string; name: string; status: EventStatus; description: string | null; location: string | null; startDate: string; endDate: string; currency: string; tokenCurrencyRate: string } }) {
  return (
    <Link to={`/events/${event.id}`} className="group">
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg">{event.name}</CardTitle>
              {event.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {event.description}
                </CardDescription>
              )}
            </div>
            <StatusBadge status={event.status} />
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-3.5 shrink-0" />
              <span>{formatDate(event.startDate)} — {formatDate(event.endDate)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <div className="flex w-full items-center justify-end text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open dashboard
            <ArrowRightIcon className="ml-1 size-3.5" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');

  const filters: EventQuery = {
    ...(search && { search }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsService.list(filters).then((r) => r.data),
  });

  const events = data?.events ?? [];

  return (
    <>
      <SectionCards events={events} />

      <div className="px-4 lg:px-6">
        {/* Header with filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as EventStatus | 'all')}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="setup">Setup</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="settlement">Settlement</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon className="size-4" />
            Create Event
          </Button>
        </div>

        {/* Event cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarIcon className="size-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-medium">No events yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first event to get started with Endow.
              </p>
              <Button
                className="mt-6"
                onClick={() => setDialogOpen(true)}
              >
                <PlusIcon className="size-4" />
                Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <CreateEventDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
