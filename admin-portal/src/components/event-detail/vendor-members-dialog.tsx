import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

import type { Vendor, VendorMember } from '@/types';
import { vendorsService } from '@/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FieldLabel } from '@/components/ui/field';
import { extractErrorMessage } from './helpers';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function VendorMembersDialog({
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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier');
  const [removeMember, setRemoveMember] = useState<VendorMember | null>(null);

  const membersQuery = useQuery({
    queryKey: ['events', eventId, 'vendors', vendor?.id, 'members'],
    queryFn: () => vendorsService.listMembers(eventId, vendor!.id).then((r) => r.data),
    enabled: open && !!vendor,
  });

  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('cashier');
      setRemoveMember(null);
    }
  }, [open]);

  const invalidateMembers = () => {
    queryClient.invalidateQueries({
      queryKey: ['events', eventId, 'vendors', vendor?.id, 'members'],
    });
  };

  const addMutation = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('No vendor');
      return vendorsService.addMember(eventId, vendor.id, {
        email: email.trim(),
        role,
      });
    },
    onSuccess: () => {
      invalidateMembers();
      toast.success('Member added');
      setEmail('');
      setRole('cashier');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'Failed to add member'));
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: 'manager' | 'cashier';
    }) => vendorsService.updateMemberRole(eventId, vendor!.id, memberId, role),
    onSuccess: () => {
      invalidateMembers();
      toast.success('Role updated');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'Failed to update role'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      vendorsService.removeMember(eventId, vendor!.id, memberId),
    onSuccess: () => {
      invalidateMembers();
      toast.success('Member removed');
      setRemoveMember(null);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, 'Failed to remove member'));
    },
  });

  const members = membersQuery.data ?? [];
  const canSubmit = isValidEmail(email.trim()) && !addMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            Users with vendor access for <strong>{vendor?.businessName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </h4>
            {membersQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : members.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                No members yet.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.userName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.userEmail}
                      </p>
                    </div>
                    {member.role === 'owner' ? (
                      <Badge variant="secondary" className="shrink-0">
                        owner
                      </Badge>
                    ) : (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(val) =>
                            roleMutation.mutate({
                              memberId: member.id,
                              role: val as 'manager' | 'cashier',
                            })
                          }
                          disabled={roleMutation.isPending}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="cashier">Cashier</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setRemoveMember(member)}
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add a member</h4>
            <p className="text-xs text-muted-foreground">
              Enter an email address. If the user does not have an account yet,
              one will be created and they can sign in with this email.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <Field>
                <FieldLabel htmlFor="vendor-member-email">Email</FieldLabel>
                <Input
                  id="vendor-member-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) addMutation.mutate();
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={role}
                  onValueChange={(val) => setRole(val as 'manager' | 'cashier')}
                >
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button
              className="w-full"
              onClick={() => addMutation.mutate()}
              disabled={!canSubmit}
            >
              {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add Member
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        <Dialog
          open={removeMember !== null}
          onOpenChange={(o) => !o && setRemoveMember(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
              <DialogDescription>
                Remove <strong>{removeMember?.userName}</strong> from this vendor?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveMember(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  removeMember && removeMutation.mutate(removeMember.id)
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
      </DialogContent>
    </Dialog>
  );
}
