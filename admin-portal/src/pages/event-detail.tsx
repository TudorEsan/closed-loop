import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  UserPlus,
  ChevronDown,
  TrendingUpIcon,
  WalletIcon,
  UsersIcon,
  StoreIcon,
  ActivityIcon,
} from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  eventsService,
  vendorsService,
  usersService,
  ticketsService,
} from '@/services';
import type {
  Event,
  EventStatus,
  EventMember,
  EventMemberRole,
  CreateVendorDto,
  Vendor,
  VendorStatus,
  VendorProductType,
  User,
} from '@/types';
import {
  VENDOR_PRODUCT_TYPES,
  VENDOR_PRODUCT_TYPE_LABELS,
} from '@/types/vendor';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BraceletsTab } from '@/components/event-detail/bracelets-tab';
import { AttendeesTab } from '@/components/event-detail/attendees-tab';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

// Helpers

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateForInput(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_TRANSITIONS: Record<EventStatus, EventStatus | null> = {
  draft: 'setup',
  setup: 'active',
  active: 'settlement',
  settlement: 'closed',
  closed: null,
};

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  setup: 'Setup',
  active: 'Active',
  settlement: 'Settlement',
  closed: 'Closed',
};

const STATUS_BADGE_CONFIG: Record<EventStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  draft: { variant: 'secondary' },
  setup: { variant: 'outline', className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400' },
  active: { variant: 'default', className: 'bg-emerald-600 text-white' },
  settlement: { variant: 'outline', className: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400' },
  closed: { variant: 'destructive' },
};

function vendorStatusBadgeVariant(status: VendorStatus) {
  switch (status) {
    case 'approved':
      return 'default' as const;
    case 'pending':
      return 'secondary' as const;
    case 'rejected':
      return 'destructive' as const;
    case 'suspended':
      return 'outline' as const;
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (typeof anyErr.message === 'string') return anyErr.message;
  }
  return fallback;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Currencies

const CURRENCIES = [
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'RON', label: 'RON - Romanian Leu' },
  { code: 'CHF', label: 'CHF - Swiss Franc' },
  { code: 'PLN', label: 'PLN - Polish Zloty' },
  { code: 'CZK', label: 'CZK - Czech Koruna' },
  { code: 'HUF', label: 'HUF - Hungarian Forint' },
  { code: 'SEK', label: 'SEK - Swedish Krona' },
  { code: 'NOK', label: 'NOK - Norwegian Krone' },
  { code: 'DKK', label: 'DKK - Danish Krone' },
  { code: 'TRY', label: 'TRY - Turkish Lira' },
  { code: 'CAD', label: 'CAD - Canadian Dollar' },
  { code: 'AUD', label: 'AUD - Australian Dollar' },
  { code: 'JPY', label: 'JPY - Japanese Yen' },
] as const;

// Form Types

type EditEventFormData = {
  name: string;
  description: string;
  currency: string;
  tokenCurrencyRate: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
};

type CreateVendorFormData = {
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  productType: VendorProductType | '';
  description: string;
};

// Transaction Chart (placeholder data for now)

function generateMockChartData(event: Event) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const now = new Date();
  const effectiveEnd = end < now ? end : now;

  if (start > now || event.status === 'draft' || event.status === 'setup') {
    return [];
  }

  const data: { date: string; volume: number; transactions: number }[] = [];
  const current = new Date(start);

  while (current <= effectiveEnd) {
    const hour = current.getHours();
    const isDay = hour >= 10 && hour <= 23;
    const base = isDay ? 150 + Math.random() * 350 : 10 + Math.random() * 40;
    const txCount = isDay ? 20 + Math.floor(Math.random() * 80) : Math.floor(Math.random() * 10);

    data.push({
      date: current.toISOString(),
      volume: Math.round(base * 100) / 100,
      transactions: txCount,
    });

    current.setHours(current.getHours() + 4);
  }

  return data;
}

const chartConfig = {
  volume: {
    label: 'Volume',
    color: 'var(--primary)',
  },
  transactions: {
    label: 'Transactions',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

function TransactionChart({ event }: { event: Event }) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState('all');
  const [chartMode, setChartMode] = useState<'volume' | 'transactions'>('volume');
  const allData = generateMockChartData(event);

  const filteredData = allData.filter((item) => {
    if (timeRange === 'all') return true;
    const date = new Date(item.date);
    const ref = new Date(allData[allData.length - 1]?.date ?? new Date());
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(ref);
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  });

  if (allData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume</CardTitle>
          <CardDescription>
            No transaction data available yet. Data will appear once the event goes live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ActivityIcon className="mx-auto mb-2 size-8 opacity-40" />
              <p className="text-sm">Waiting for transactions...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          {chartMode === 'volume' ? 'Transaction Volume' : 'Number of Transactions'}
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {chartMode === 'volume'
              ? `Total volume in ${event.currency} over time`
              : 'Transaction count over time'}
          </span>
          <span className="@[540px]/card:hidden">
            {chartMode === 'volume' ? event.currency : 'Count'}
          </span>
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={chartMode}
              onValueChange={(v) => v && setChartMode(v as 'volume' | 'transactions')}
              variant="outline"
              className="hidden @[600px]/card:flex"
            >
              <ToggleGroupItem value="volume" className="px-3 text-xs">Volume</ToggleGroupItem>
              <ToggleGroupItem value="transactions" className="px-3 text-xs">Transactions</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(v) => v && setTimeRange(v)}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:px-3! @[767px]/card:flex"
            >
              <ToggleGroupItem value="7d">7d</ToggleGroupItem>
              <ToggleGroupItem value="30d">30d</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="flex w-24 @[767px]/card:hidden"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-volume)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-volume)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey={chartMode}
              type="natural"
              fill="url(#fillChart)"
              stroke="var(--color-volume)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Stats Cards for event

function EventStatsCards({ event, vendorCount, memberCount }: { event: Event; vendorCount: number; memberCount: number }) {
  const chartData = generateMockChartData(event);
  const totalVolume = chartData.reduce((sum, d) => sum + d.volume, 0);
  const totalTx = chartData.reduce((sum, d) => sum + d.transactions, 0);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Volume</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalVolume > 0 ? `${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${event.currency}` : 'N/A'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <WalletIcon className="size-3" />
              {event.status === 'active' ? 'Live' : STATUS_LABELS[event.status]}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalVolume > 0 ? (
              <>
                <TrendingUpIcon className="size-4" />
                Token rate: {event.tokenCurrencyRate}
              </>
            ) : (
              'No transactions yet'
            )}
          </div>
          <div className="text-muted-foreground">
            Currency: {event.currency}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Transactions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalTx > 0 ? totalTx.toLocaleString() : 'N/A'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={event.status === 'active' ? 'text-emerald-600' : ''}>
              <ActivityIcon className="size-3" />
              {event.status === 'active' ? 'Processing' : 'Idle'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalTx > 0 ? 'All transaction types' : 'Waiting for activity'}
          </div>
          <div className="text-muted-foreground">
            Top-ups, purchases, refunds
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Vendors</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {vendorCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <StoreIcon className="size-3" />
              Registered
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Accepting payments
          </div>
          <div className="text-muted-foreground">
            Food, drinks, merchandise
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Team Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {memberCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UsersIcon className="size-3" />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Managing the event
          </div>
          <div className="text-muted-foreground">
            Organizers, admins, operators
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Overview Tab

function OverviewTab({
  event,
  onEditClick,
}: {
  event: Event;
  onEditClick: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{event.name}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs">{event.slug}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="max-w-[250px] text-right">
                {event.description || 'No description'}
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd>{event.location || 'Not set'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Start Date</dt>
              <dd>{formatDate(event.startDate)}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">End Date</dt>
              <dd>{formatDate(event.endDate)}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Timezone</dt>
              <dd>{event.timezone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{event.currency}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Token Rate</dt>
              <dd>
                1 token = {event.tokenCurrencyRate} {event.currency}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// Edit Event Dialog

function EditEventDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EditEventFormData>({
    defaultValues: {
      name: event.name,
      description: event.description ?? '',
      currency: event.currency,
      tokenCurrencyRate: String(event.tokenCurrencyRate),
      startDate: formatDateForInput(event.startDate),
      endDate: formatDateForInput(event.endDate),
      timezone: event.timezone,
      location: event.location || '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: event.name,
        description: event.description || '',
        currency: event.currency,
        tokenCurrencyRate: String(event.tokenCurrencyRate),
        startDate: formatDateForInput(event.startDate),
        endDate: formatDateForInput(event.endDate),
        timezone: event.timezone,
        location: event.location || '',
      });
    }
  }, [open, event, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditEventFormData) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        tokenCurrencyRate: Number(data.tokenCurrencyRate),
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      if (data.description) payload.description = data.description;
      if (data.currency) payload.currency = data.currency;
      if (data.timezone) payload.timezone = data.timezone;
      if (data.location) payload.location = data.location;

      return eventsService.update(event.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', event.id] });
      toast.success('Event updated successfully');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to update event');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the event details below.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
          className="grid gap-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-name">Name</FieldLabel>
              <Input id="edit-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-description">Description</FieldLabel>
              <Input id="edit-description" {...register('description')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
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
                <FieldLabel htmlFor="edit-tokenRate">Token Rate</FieldLabel>
                <Input
                  id="edit-tokenRate"
                  type="number"
                  step="any"
                  {...register('tokenCurrencyRate')}
                />
                {errors.tokenCurrencyRate && (
                  <FieldError>{errors.tokenCurrencyRate.message}</FieldError>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="edit-start">Start Date</FieldLabel>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  {...register('startDate')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-end">End Date</FieldLabel>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  {...register('endDate')}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="edit-timezone">Timezone</FieldLabel>
                <Input id="edit-timezone" {...register('timezone')} placeholder="Europe/Bucharest" />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-location">Location</FieldLabel>
                <Input id="edit-location" {...register('location')} placeholder="Cluj-Napoca" />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Delete Event Dialog

function DeleteEventDialog({
  eventId,
  eventName,
  open,
  onOpenChange,
}: {
  eventId: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => eventsService.delete(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
      navigate('/dashboard');
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Event</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{eventName}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Team Tab

function TeamTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<EventMember | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['events', eventId, 'members'],
    queryFn: () => eventsService.listMembers(eventId).then((r) => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      eventsService.removeMember(eventId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'members'],
      });
      toast.success('Member removed');
      setRemoveTarget(null);
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {members?.length ?? 0} member{members?.length !== 1 ? 's' : ''}
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-3.5" />
          Add Member
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Date Added</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No team members yet
                </TableCell>
              </TableRow>
            )}
            {members?.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.userName}</TableCell>
                <TableCell>{member.userEmail}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.role}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{formatDate(member.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setRemoveTarget(member)}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddMemberDialog eventId={eventId} open={addOpen} onOpenChange={setAddOpen} />

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeTarget?.userName}</strong> from this event?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add Member Dialog

function AddMemberDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<EventMemberRole>('operator');

  const debouncedEmail = useDebounce(searchEmail, 300);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['users', 'search', debouncedEmail],
    queryFn: () =>
      usersService.list({ search: debouncedEmail }).then((r) => r.data.users),
    enabled: debouncedEmail.length >= 3,
  });

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const addMutation = useMutation({
    mutationFn: () => {
      if (selectedUser) {
        return eventsService.addMember(eventId, {
          userId: selectedUser.id,
          role: selectedRole,
        });
      }
      return eventsService.addMember(eventId, {
        email: inviteEmail!,
        role: selectedRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'members'],
      });
      toast.success(inviteEmail ? 'Invitation sent' : 'Member added');
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to add member');
    },
  });

  const resetForm = useCallback(() => {
    setSearchEmail('');
    setSelectedUser(null);
    setInviteEmail(null);
    setSelectedRole('operator');
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Search for a user by email and assign them a role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedUser && !inviteEmail ? (
            <div className="space-y-2">
              <Field>
                <FieldLabel htmlFor="search-email">Search by email</FieldLabel>
                <Input
                  id="search-email"
                  type="email"
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  autoFocus
                />
              </Field>

              {isSearching && (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Searching...
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{user.role}</Badge>
                    </button>
                  ))}
                </div>
              )}

              {searchResults &&
                searchResults.length === 0 &&
                debouncedEmail.length >= 3 && (
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted-foreground">
                      No users found for that email.
                    </p>
                    {isValidEmail(debouncedEmail) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setInviteEmail(debouncedEmail)}
                      >
                        Invite {debouncedEmail}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Enter a full email address to send an invite.
                      </p>
                    )}
                  </div>
                )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  {selectedUser ? (
                    <>
                      <p className="truncate font-medium">{selectedUser.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {selectedUser.email}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="truncate font-medium">New invite</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {inviteEmail}
                      </p>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(null);
                    setInviteEmail(null);
                  }}
                >
                  Change
                </Button>
              </div>

              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={selectedRole}
                  onValueChange={(val) => setSelectedRole(val as EventMemberRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={(!selectedUser && !inviteEmail) || addMutation.isPending}
          >
            {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {inviteEmail ? 'Send Invite' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Vendors Tab

function VendorsTab({ eventId, event }: { eventId: string; event: Event }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [commissionTarget, setCommissionTarget] = useState<Vendor | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Vendor | null>(null);

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['events', eventId, 'vendors'],
    queryFn: () => vendorsService.list(eventId).then((r) => r.data),
  });

  const vendors = vendorData?.vendors ?? [];

  const statusMutation = useMutation({
    mutationFn: ({
      vendorId,
      status,
    }: {
      vendorId: string;
      status: VendorStatus;
    }) => vendorsService.updateStatus(eventId, vendorId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'vendors'],
      });
      toast.success('Vendor status updated');
    },
    onError: () => {
      toast.error('Failed to update vendor status');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (vendorId: string) => vendorsService.remove(eventId, vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'vendors'],
      });
      toast.success('Vendor removed');
      setRemoveTarget(null);
    },
    onError: () => {
      toast.error('Failed to remove vendor');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          Add Vendor
        </Button>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <StoreIcon className="size-10 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium">No vendors yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add vendors to start accepting payments at your event.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" />
              Add Vendor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{vendor.businessName}</CardTitle>
                    <CardDescription className="mt-1 truncate">
                      {vendor.contactPerson}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vendorStatusBadgeVariant(vendor.status)}>
                      {vendor.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {vendor.status === 'pending' && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({ vendorId: vendor.id, status: 'approved' })
                              }
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({ vendorId: vendor.id, status: 'rejected' })
                              }
                            >
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {vendor.status === 'approved' && (
                          <DropdownMenuItem
                            onClick={() =>
                              statusMutation.mutate({ vendorId: vendor.id, status: 'suspended' })
                            }
                          >
                            Suspend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setCommissionTarget(vendor)}>
                          Update Commission
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setRemoveTarget(vendor)}>
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 text-sm">
                  {vendor.productType && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Product</dt>
                      <dd>{VENDOR_PRODUCT_TYPE_LABELS[vendor.productType] ?? vendor.productType}</dd>
                    </div>
                  )}
                  {vendor.contactEmail && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="truncate max-w-[180px]">{vendor.contactEmail}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Commission</dt>
                    <dd className="font-medium">
                      {vendor.commissionRate != null ? `${vendor.commissionRate}%` : 'Default'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddVendorDialog eventId={eventId} open={addOpen} onOpenChange={setAddOpen} />

      <UpdateCommissionDialog
        eventId={eventId}
        vendor={commissionTarget}
        open={commissionTarget !== null}
        onOpenChange={(open) => !open && setCommissionTarget(null)}
      />

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Vendor</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeTarget?.businessName}</strong> from this
              event? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add Vendor Dialog

function AddVendorDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateVendorFormData>({
    defaultValues: {
      businessName: '',
      contactPerson: '',
      contactEmail: '',
      productType: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateVendorFormData) => {
      const payload: CreateVendorDto = {
        businessName: data.businessName.trim(),
        contactPerson: data.contactPerson.trim(),
      };
      if (data.contactEmail) payload.contactEmail = data.contactEmail.trim();
      if (data.productType) payload.productType = data.productType;
      if (data.description) payload.description = data.description.trim();

      return vendorsService.create(eventId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'vendors'],
      });
      toast.success('Vendor added');
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = extractErrorMessage(err, 'Failed to add vendor');
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>Register a new vendor for this event.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid gap-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="vendor-name">Business Name</FieldLabel>
              <Input
                id="vendor-name"
                {...register('businessName', {
                  required: 'Business name is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                  maxLength: { value: 255, message: 'Too long (max 255)' },
                })}
              />
              {errors.businessName && <FieldError>{errors.businessName.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-contact">Contact Person</FieldLabel>
              <Input
                id="vendor-contact"
                {...register('contactPerson', {
                  required: 'Contact person is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                  maxLength: { value: 255, message: 'Too long (max 255)' },
                })}
              />
              {errors.contactPerson && <FieldError>{errors.contactPerson.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-email">Email</FieldLabel>
              <Input
                id="vendor-email"
                type="email"
                {...register('contactEmail', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {errors.contactEmail && <FieldError>{errors.contactEmail.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-product">Product Type</FieldLabel>
              <Controller
                control={control}
                name="productType"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => field.onChange(value as VendorProductType)}
                  >
                    <SelectTrigger id="vendor-product">
                      <SelectValue placeholder="Select a product type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {VENDOR_PRODUCT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.productType && <FieldError>{errors.productType.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-desc">Description</FieldLabel>
              <Input
                id="vendor-desc"
                {...register('description', {
                  maxLength: { value: 1000, message: 'Too long (max 1000)' },
                })}
              />
              {errors.description && <FieldError>{errors.description.message}</FieldError>}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Update Commission Dialog

function UpdateCommissionDialog({
  eventId,
  vendor,
  open,
  onOpenChange,
}: {
  eventId: string;
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState('');

  useEffect(() => {
    if (open && vendor) {
      setRate(vendor.commissionRate ?? '');
    }
  }, [open, vendor]);

  const mutation = useMutation({
    mutationFn: () =>
      vendorsService.updateCommission(eventId, vendor!.id, Number(rate)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'vendors'],
      });
      toast.success('Commission rate updated');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to update commission rate');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Commission Rate</DialogTitle>
          <DialogDescription>
            Set a custom commission rate for <strong>{vendor?.businessName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="commission-rate">Commission Rate (%)</FieldLabel>
          <Input
            id="commission-rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!rate || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Page Loading Skeleton

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

// Main Page

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
          <p className="text-muted-foreground">
            Could not load event details.
          </p>
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
      {/* Header */}
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
          <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
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
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <EventStatsCards event={event} vendorCount={vendorCount} memberCount={memberCount} />

      {/* Chart */}
      <div className="px-4 lg:px-6">
        <TransactionChart event={event} />
      </div>

      {/* Tabs */}
      <div className="px-4 lg:px-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">
              Team
              {memberCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {memberCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vendors">
              Vendors
              {vendorCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {vendorCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attendees">
              Attendees
              {pendingInviteCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
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
            <VendorsTab eventId={event.id} event={event} />
          </TabsContent>

          <TabsContent value="attendees" className="mt-4">
            <AttendeesTab eventId={event.id} />
          </TabsContent>

          <TabsContent value="bracelets" className="mt-4">
            <BraceletsTab eventId={event.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <EditEventDialog event={event} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEventDialog
        eventId={event.id}
        eventName={event.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
