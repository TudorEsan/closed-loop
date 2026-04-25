import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowRightLeftIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  ScanLineIcon,
  ShieldOffIcon,
} from 'lucide-react';

import { braceletsService, usersService } from '@/services';
import type {
  BraceletAssignment,
  BraceletStatus,
  User,
} from '@/types';
import { BRACELET_STATUS_LABELS } from '@/types';
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

const UID_PATTERN = /^[A-Za-z0-9:_-]{4,64}$/;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const statusBadgeVariant = (status: BraceletStatus) => {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'replaced':
      return 'secondary' as const;
    case 'revoked':
      return 'destructive' as const;
  }
};

export function BraceletsTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<BraceletAssignment | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<BraceletAssignment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['events', eventId, 'bracelets'],
    queryFn: () => braceletsService.list(eventId).then((r) => r.data),
  });

  const bracelets = data?.bracelets ?? [];
  const activeCount = bracelets.filter((b) => b.status === 'active').length;

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
          {activeCount} active, {bracelets.length} total
        </h3>
        <Button size="sm" onClick={() => setLinkOpen(true)}>
          <Plus className="size-3.5" />
          Link Bracelet
        </Button>
      </div>

      {bracelets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScanLineIcon className="size-10 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium">No bracelets linked yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap a wristband and assign it to an attendee for this festival.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setLinkOpen(true)}>
              <Plus className="size-3.5" />
              Link Bracelet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bracelets.map((bracelet) => (
            <Card key={bracelet.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">
                      {bracelet.user?.name ?? 'Unknown attendee'}
                    </CardTitle>
                    <CardDescription className="mt-1 truncate font-mono">
                      {bracelet.wristbandUid}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(bracelet.status)}>
                      {BRACELET_STATUS_LABELS[bracelet.status]}
                    </Badge>
                    {bracelet.status === 'active' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Bracelet actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setReplaceTarget(bracelet)}>
                            <ArrowRightLeftIcon className="size-3.5" />
                            Replace bracelet
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRevokeTarget(bracelet)}
                          >
                            <ShieldOffIcon className="size-3.5" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 text-sm">
                  {bracelet.user?.email && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="truncate">{bracelet.user.email}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Linked</dt>
                    <dd>{new Date(bracelet.linkedAt).toLocaleDateString()}</dd>
                  </div>
                  {bracelet.revokedAt && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {bracelet.status === 'replaced' ? 'Replaced' : 'Revoked'}
                      </dt>
                      <dd>{new Date(bracelet.revokedAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {bracelet.revokeReason && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd className="truncate text-right">{bracelet.revokeReason}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LinkBraceletDialog
        eventId={eventId}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
      <RevokeBraceletDialog
        eventId={eventId}
        target={revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      />
      <ReplaceBraceletDialog
        eventId={eventId}
        target={replaceTarget}
        onOpenChange={(open) => !open && setReplaceTarget(null)}
      />
    </div>
  );
}

// ---- Link dialog ----

type LinkFormValues = {
  wristbandUid: string;
};

function LinkBraceletDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkFormValues>({ defaultValues: { wristbandUid: '' } });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => usersService.list({ search: debouncedSearch }).then((r) => r.data.users),
    enabled: debouncedSearch.length >= 3,
  });

  const linkMutation = useMutation({
    mutationFn: (values: LinkFormValues) =>
      braceletsService.link(eventId, {
        userId: selectedUser!.id,
        wristbandUid: values.wristbandUid,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracelets'] });
      toast.success('Bracelet linked');
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = extractApiMessage(err) ?? 'Failed to link bracelet';
      setServerError(message);
    },
  });

  const resetForm = useCallback(() => {
    setSearchTerm('');
    setSelectedUser(null);
    setServerError(null);
    reset({ wristbandUid: '' });
  }, [reset]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const onSubmit = (values: LinkFormValues) => {
    setServerError(null);
    if (!selectedUser) {
      setServerError('Please select an attendee first');
      return;
    }
    linkMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a bracelet</DialogTitle>
          <DialogDescription>
            Search for an attendee and bind a wristband UID to them for this festival.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bracelet-search">Attendee</FieldLabel>
              {!selectedUser ? (
                <>
                  <Input
                    id="bracelet-search"
                    placeholder="Name or email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {isSearching && (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Searching
                    </div>
                  )}
                  {searchResults && searchResults.length > 0 && (
                    <div className="max-h-52 overflow-y-auto rounded-lg border">
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
                          <Badge variant="outline" className="shrink-0">
                            {user.role}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults && searchResults.length === 0 && debouncedSearch.length >= 3 && (
                    <p className="py-2 text-sm text-muted-foreground">No matching users.</p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedUser.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedUser(null)}
                  >
                    Change
                  </Button>
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="bracelet-uid">Wristband UID</FieldLabel>
              <Input
                id="bracelet-uid"
                placeholder="04:A1:B2:C3:D4:E5:F6"
                autoComplete="off"
                spellCheck={false}
                {...register('wristbandUid', {
                  required: 'UID is required',
                  pattern: {
                    value: UID_PATTERN,
                    message: 'UID must be 4 to 64 chars, alphanumerics, colon, underscore or hyphen',
                  },
                })}
              />
              {errors.wristbandUid && (
                <FieldError>{errors.wristbandUid.message}</FieldError>
              )}
            </Field>

            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={linkMutation.isPending || !selectedUser}>
              {linkMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Link bracelet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Revoke dialog ----

function RevokeBraceletDialog({
  eventId,
  target,
  onOpenChange,
}: {
  eventId: string;
  target: BraceletAssignment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!target) setReason('');
  }, [target]);

  const revokeMutation = useMutation({
    mutationFn: () => braceletsService.revoke(eventId, target!.id, { reason: reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracelets'] });
      toast.success('Bracelet revoked');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(extractApiMessage(err) ?? 'Failed to revoke bracelet');
    },
  });

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke bracelet</DialogTitle>
          <DialogDescription>
            This wristband will no longer be valid at the venue. The attendee can be issued a new
            bracelet through Replace if they need one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Field>
            <FieldLabel htmlFor="revoke-reason">Reason (optional)</FieldLabel>
            <Input
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lost, stolen, defective, etc."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
          >
            {revokeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Replace dialog ----

type ReplaceFormValues = {
  wristbandUid: string;
  reason: string;
};

function ReplaceBraceletDialog({
  eventId,
  target,
  onOpenChange,
}: {
  eventId: string;
  target: BraceletAssignment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReplaceFormValues>({
    defaultValues: { wristbandUid: '', reason: '' },
  });

  useEffect(() => {
    if (!target) {
      reset({ wristbandUid: '', reason: '' });
      setServerError(null);
    }
  }, [target, reset]);

  const replaceMutation = useMutation({
    mutationFn: (values: ReplaceFormValues) =>
      braceletsService.replace(eventId, target!.id, {
        wristbandUid: values.wristbandUid,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracelets'] });
      toast.success('Bracelet replaced');
      onOpenChange(false);
    },
    onError: (err) => {
      setServerError(extractApiMessage(err) ?? 'Failed to replace bracelet');
    },
  });

  const onSubmit = (values: ReplaceFormValues) => {
    setServerError(null);
    replaceMutation.mutate(values);
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace bracelet</DialogTitle>
          <DialogDescription>
            Bind a new wristband UID to the same attendee. The old assignment will be marked
            replaced and the new one becomes active immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            {target?.user && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="truncate text-sm font-medium">{target.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Old UID: <span className="font-mono">{target.wristbandUid}</span>
                </p>
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="replace-uid">New wristband UID</FieldLabel>
              <Input
                id="replace-uid"
                placeholder="04:A1:B2:C3:D4:E5:F7"
                autoComplete="off"
                spellCheck={false}
                {...register('wristbandUid', {
                  required: 'UID is required',
                  pattern: {
                    value: UID_PATTERN,
                    message: 'UID must be 4 to 64 chars, alphanumerics, colon, underscore or hyphen',
                  },
                })}
              />
              {errors.wristbandUid && (
                <FieldError>{errors.wristbandUid.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="replace-reason">Reason (optional)</FieldLabel>
              <Input
                id="replace-reason"
                placeholder="Lost, broken clasp, etc."
                {...register('reason')}
              />
            </Field>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={replaceMutation.isPending}>
              {replaceMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Replace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function extractApiMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const maybe = err as { response?: { data?: { message?: string | string[] } } };
  const message = maybe.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? null;
}
