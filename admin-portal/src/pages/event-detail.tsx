import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  UserPlus,
  ChevronDown,
} from 'lucide-react';

import { eventsService, vendorsService, usersService } from '@/services';
import type {
  Event,
  EventStatus,
  EventMember,
  EventMemberRole,
  CreateVendorDto,
  Vendor,
  VendorStatus,
  User,
} from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function statusBadgeVariant(status: EventStatus) {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'draft':
      return 'secondary' as const;
    case 'closed':
      return 'outline' as const;
    case 'settlement':
      return 'outline' as const;
    case 'setup':
      return 'secondary' as const;
  }
}

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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Currencies ─────────────────────────────────────────────────────────────

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

// ─── Form Types ─────────────────────────────────────────────────────────────

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
  contactPhone: string;
  productType: string;
  description: string;
};

// ─── Overview Tab ────────────────────────────────────────────────────────────

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
            <Separator />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Edit Event Dialog ───────────────────────────────────────────────────────

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
                {errors.startDate && (
                  <FieldError>{errors.startDate.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-end">End Date</FieldLabel>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  {...register('endDate')}
                />
                {errors.endDate && (
                  <FieldError>{errors.endDate.message}</FieldError>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="edit-timezone">Timezone</FieldLabel>
                <Input
                  id="edit-timezone"
                  {...register('timezone')}
                  placeholder="Europe/Bucharest"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-location">Location</FieldLabel>
                <Input
                  id="edit-location"
                  {...register('location')}
                  placeholder="Cluj-Napoca"
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Event Dialog ─────────────────────────────────────────────────────

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
      navigate('/events');
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
            {deleteMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────────────────

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Date Added</TableHead>
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
              <TableCell>{formatDate(member.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRemoveTarget(member)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AddMemberDialog
        eventId={eventId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

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
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget.id)
              }
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add Member Dialog ───────────────────────────────────────────────────────

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
  const [selectedRole, setSelectedRole] = useState<EventMemberRole>('operator');

  const debouncedEmail = useDebounce(searchEmail, 300);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['users', 'search', debouncedEmail],
    queryFn: () =>
      usersService.list({ search: debouncedEmail }).then((r) => r.data.users),
    enabled: debouncedEmail.length >= 3,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      eventsService.addMember(eventId, selectedUser!.id, selectedRole),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'members'],
      });
      toast.success('Member added');
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
          {!selectedUser ? (
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
                        <p className="truncate text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {searchResults &&
                searchResults.length === 0 &&
                debouncedEmail.length >= 3 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    No users found for that email.
                  </p>
                )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{selectedUser.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  Change
                </Button>
              </div>

              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={selectedRole}
                  onValueChange={(val) =>
                    setSelectedRole(val as EventMemberRole)
                  }
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
            disabled={!selectedUser || addMutation.isPending}
          >
            {addMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vendors Tab ─────────────────────────────────────────────────────────────

function VendorsTab({ eventId }: { eventId: string }) {
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business Name</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                No vendors yet
              </TableCell>
            </TableRow>
          )}
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-medium">
                {vendor.businessName}
              </TableCell>
              <TableCell>{vendor.contactPerson}</TableCell>
              <TableCell>{vendor.contactEmail || 'N/A'}</TableCell>
              <TableCell>
                <Badge variant={vendorStatusBadgeVariant(vendor.status)}>
                  {vendor.status}
                </Badge>
              </TableCell>
              <TableCell>
                {vendor.commissionRate != null
                  ? `${vendor.commissionRate}%`
                  : 'Default'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {vendor.status === 'pending' && (
                      <>
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              vendorId: vendor.id,
                              status: 'approved',
                            })
                          }
                        >
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              vendorId: vendor.id,
                              status: 'rejected',
                            })
                          }
                        >
                          Reject
                        </DropdownMenuItem>
                      </>
                    )}
                    {vendor.status === 'approved' && (
                      <DropdownMenuItem
                        onClick={() =>
                          statusMutation.mutate({
                            vendorId: vendor.id,
                            status: 'suspended',
                          })
                        }
                      >
                        Suspend
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setCommissionTarget(vendor)}
                    >
                      Update Commission
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setRemoveTarget(vendor)}
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AddVendorDialog
        eventId={eventId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

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
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget.id)
              }
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add Vendor Dialog ───────────────────────────────────────────────────────

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
    formState: { errors },
  } = useForm<CreateVendorFormData>({
    defaultValues: {
      businessName: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
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
        businessName: data.businessName,
        contactPerson: data.contactPerson,
      };
      if (data.contactEmail) payload.contactEmail = data.contactEmail;
      if (data.contactPhone) payload.contactPhone = data.contactPhone;
      if (data.productType) payload.productType = data.productType;
      if (data.description) payload.description = data.description;

      return vendorsService.create(eventId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'vendors'],
      });
      toast.success('Vendor added');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to add vendor');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>
            Register a new vendor for this event.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid gap-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="vendor-name">Business Name</FieldLabel>
              <Input id="vendor-name" {...register('businessName')} />
              {errors.businessName && (
                <FieldError>{errors.businessName.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-contact">Contact Person</FieldLabel>
              <Input id="vendor-contact" {...register('contactPerson')} />
              {errors.contactPerson && (
                <FieldError>{errors.contactPerson.message}</FieldError>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="vendor-email">Email</FieldLabel>
                <Input
                  id="vendor-email"
                  type="email"
                  {...register('contactEmail')}
                />
                {errors.contactEmail && (
                  <FieldError>{errors.contactEmail.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="vendor-phone">Phone</FieldLabel>
                <Input id="vendor-phone" {...register('contactPhone')} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="vendor-product">Product Type</FieldLabel>
              <Input
                id="vendor-product"
                {...register('productType')}
                placeholder="Food, Drinks, Merchandise..."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-desc">Description</FieldLabel>
              <Input id="vendor-desc" {...register('description')} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Add Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Update Commission Dialog ────────────────────────────────────────────────

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
            Set a custom commission rate for{' '}
            <strong>{vendor?.businessName}</strong>.
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
          <Button
            onClick={() => mutation.mutate()}
            disabled={!rate || mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page Loading Skeleton ───────────────────────────────────────────────────

function EventDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

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
    return (
      <div className="mx-auto max-w-5xl p-6">
        <EventDetailSkeleton />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">
            Could not load event details.
          </p>
          <Button variant="outline" onClick={() => navigate('/events')}>
            <ArrowLeft className="size-4" />
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const nextStatus = STATUS_TRANSITIONS[event.status];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate('/events')}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-xl font-semibold">{event.name}</h1>
            <Badge variant={statusBadgeVariant(event.status)}>
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

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
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
        </Tabs>
      </div>

      {/* Dialogs */}
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
    </div>
  );
}
