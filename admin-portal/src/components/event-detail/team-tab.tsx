import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus } from 'lucide-react';

import type { EventMember } from '@/types';
import { eventsService } from '@/services';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddMemberDialog } from './add-member-dialog';
import { formatDate } from './helpers';

export function TeamTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<EventMember | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['events', eventId, 'members'],
    queryFn: () => eventsService.listMembers(eventId).then((r) => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => eventsService.removeMember(eventId, memberId),
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
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                <TableCell className="hidden sm:table-cell">
                  {formatDate(member.createdAt)}
                </TableCell>
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
