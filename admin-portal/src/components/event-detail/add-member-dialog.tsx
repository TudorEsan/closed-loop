import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import type { EventMemberRole, User } from '@/types';
import { eventsService, usersService } from '@/services';
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
import { Field, FieldLabel } from '@/components/ui/field';
import { useDebounce } from './helpers';

export function AddMemberDialog({
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
