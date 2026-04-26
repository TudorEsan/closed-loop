import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowRightLeftIcon,
  Loader2,
  MoreHorizontal,
  ScanLineIcon,
  ShieldOffIcon,
} from 'lucide-react';

import { braceletsService } from '@/services';
import type { BraceletAssignment, BraceletStatus } from '@/types';
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

const braceletBadge = (status: BraceletStatus) => {
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
  const braceletsQuery = useQuery({
    queryKey: ['events', eventId, 'bracelets'],
    queryFn: () => braceletsService.list(eventId).then((r) => r.data),
  });

  const [revokeTarget, setRevokeTarget] = useState<BraceletAssignment | null>(
    null,
  );
  const [replaceTarget, setReplaceTarget] = useState<BraceletAssignment | null>(
    null,
  );

  const bracelets = braceletsQuery.data?.bracelets ?? [];
  const activeBracelets = bracelets.filter((b) => b.status === 'active').length;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Linked bracelets</h3>
            <p className="text-sm text-muted-foreground">
              {activeBracelets} active, {bracelets.length} total
            </p>
          </div>
        </header>

        {braceletsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : bracelets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <ScanLineIcon className="size-9 text-muted-foreground/40" />
              <h3 className="mt-3 text-sm font-medium">
                No bracelets linked yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bracelets show up here once attendees redeem their invite at
                the gate.
              </p>
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
                      <Badge variant={braceletBadge(bracelet.status)}>
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
                            <DropdownMenuItem
                              onClick={() => setReplaceTarget(bracelet)}
                            >
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
                      <dd>
                        {new Date(bracelet.linkedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

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
    mutationFn: () =>
      braceletsService.revoke(eventId, target!.id, {
        reason: reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'bracelets'],
      });
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
            This wristband will no longer be valid at the venue. The attendee
            can be issued a new bracelet through Replace if they need one.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="revoke-reason">Reason (optional)</FieldLabel>
          <Input
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lost, stolen, defective, etc."
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
          >
            {revokeMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'bracelets'],
      });
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
            Bind a new wristband UID to the same attendee. The old assignment
            is marked replaced and the new one becomes active immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            {target?.user && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="truncate text-sm font-medium">
                  {target.user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Old UID:{' '}
                  <span className="font-mono">{target.wristbandUid}</span>
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
                    message:
                      'UID must be 4 to 64 chars, alphanumerics, colon, underscore or hyphen',
                  },
                })}
              />
              {errors.wristbandUid && (
                <FieldError>{errors.wristbandUid.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="replace-reason">
                Reason (optional)
              </FieldLabel>
              <Input
                id="replace-reason"
                placeholder="Lost, broken clasp, etc."
                {...register('reason')}
              />
            </Field>

            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={replaceMutation.isPending}>
              {replaceMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
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
  const maybe = err as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = maybe.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? null;
}
