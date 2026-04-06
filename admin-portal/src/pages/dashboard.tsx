import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PlusIcon,
  SearchIcon,
  MoreHorizontalIcon,
  EyeIcon,
  Trash2Icon,
  Loader2,
  CalendarIcon,
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { code: 'RON', label: 'RON - Romanian Leu', symbol: 'lei' },
  { code: 'CHF', label: 'CHF - Swiss Franc', symbol: 'Fr' },
  { code: 'PLN', label: 'PLN - Polish Zloty', symbol: 'zł' },
  { code: 'CZK', label: 'CZK - Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', label: 'HUF - Hungarian Forint', symbol: 'Ft' },
  { code: 'SEK', label: 'SEK - Swedish Krona', symbol: 'kr' },
  { code: 'NOK', label: 'NOK - Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', label: 'DKK - Danish Krone', symbol: 'kr' },
  { code: 'BGN', label: 'BGN - Bulgarian Lev', symbol: 'лв' },
  { code: 'HRK', label: 'HRK - Croatian Kuna', symbol: 'kn' },
  { code: 'RSD', label: 'RSD - Serbian Dinar', symbol: 'din' },
  { code: 'TRY', label: 'TRY - Turkish Lira', symbol: '₺' },
  { code: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { code: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
] as const;

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
  currency: string;
  tokenCurrencyRate: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
};

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
    control,
  } = useForm<CreateEventFormValues>({
    defaultValues: {
      name: '',
      description: '',
      currency: 'EUR',
      tokenCurrencyRate: '',
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
    if (!values.name || !values.startDate || !values.endDate || !values.tokenCurrencyRate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const dto: CreateEventDto = {
      name: values.name,
      tokenCurrencyRate: Number(values.tokenCurrencyRate),
      startDate: new Date(values.startDate).toISOString(),
      endDate: new Date(values.endDate).toISOString(),
    };

    if (values.description) dto.description = values.description;
    if (values.currency) dto.currency = values.currency;
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Event Name</FieldLabel>
              <Input id="name" placeholder="Summer Festival 2026" {...register('name')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input id="description" placeholder="Short description of the event" {...register('description')} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tokenCurrencyRate">Token Rate</FieldLabel>
                <Input id="tokenCurrencyRate" type="number" step="any" placeholder="1.00" {...register('tokenCurrencyRate')} />
                <FieldDescription>Tokens per 1 unit of currency</FieldDescription>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                <Input id="startDate" type="datetime-local" {...register('startDate')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date</FieldLabel>
                <Input id="endDate" type="datetime-local" {...register('endDate')} />
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
// Dashboard Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const queryClient = useQueryClient();
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  const events = data?.events ?? [];

  return (
    <>
      <SectionCards events={events} />

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Events</CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <PlusIcon className="size-4" />
              Create Event
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
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

            {/* Table */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarIcon className="size-10 text-muted-foreground/40" />
                <h3 className="mt-4 text-base font-medium">No events yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first event to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setDialogOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Create Event
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead className="hidden sm:table-cell">Start</TableHead>
                      <TableHead className="hidden sm:table-cell">End</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/events/${event.id}`}
                            className="hover:underline underline-offset-4"
                          >
                            {event.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={event.status} />
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {event.location ?? '\u2014'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDate(event.startDate)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDate(event.endDate)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontalIcon className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/events/${event.id}`}>
                                  <EyeIcon className="size-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(event.id)}
                              >
                                <Trash2Icon className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateEventDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
