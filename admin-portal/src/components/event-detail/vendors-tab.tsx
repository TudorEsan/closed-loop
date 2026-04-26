import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, Plus, StoreIcon } from 'lucide-react';

import type { Vendor, VendorStatus } from '@/types';
import { VENDOR_PRODUCT_TYPE_LABELS } from '@/types/vendor';
import { vendorsService } from '@/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { AddVendorDialog } from './add-vendor-dialog';
import { UpdateCommissionDialog } from './update-commission-dialog';
import { VendorMembersDialog } from './vendor-members-dialog';
import { vendorStatusBadgeVariant } from './helpers';

export function VendorsTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [commissionTarget, setCommissionTarget] = useState<Vendor | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Vendor | null>(null);
  const [membersTarget, setMembersTarget] = useState<Vendor | null>(null);

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
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAddOpen(true)}
            >
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
                    <CardTitle className="truncate text-base">
                      {vendor.businessName}
                    </CardTitle>
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
                        <DropdownMenuItem onClick={() => setCommissionTarget(vendor)}>
                          Update Commission
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMembersTarget(vendor)}>
                          Manage Members
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
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 text-sm">
                  {vendor.productType && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Product</dt>
                      <dd>
                        {VENDOR_PRODUCT_TYPE_LABELS[vendor.productType] ??
                          vendor.productType}
                      </dd>
                    </div>
                  )}
                  {vendor.contactEmail && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="max-w-[180px] truncate">{vendor.contactEmail}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Commission</dt>
                    <dd className="font-medium">
                      {vendor.commissionRate != null
                        ? `${vendor.commissionRate}%`
                        : 'Default'}
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

      <VendorMembersDialog
        eventId={eventId}
        vendor={membersTarget}
        open={membersTarget !== null}
        onOpenChange={(open) => !open && setMembersTarget(null)}
      />

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Vendor</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeTarget?.businessName}</strong> from this event?
              This cannot be undone.
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
