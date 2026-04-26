import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import type { Vendor } from '@/types';
import { vendorsService } from '@/services';
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
import { Field, FieldLabel } from '@/components/ui/field';

export function UpdateCommissionDialog({
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
