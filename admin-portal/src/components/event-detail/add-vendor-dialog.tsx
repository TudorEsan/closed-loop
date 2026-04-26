import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import type { CreateVendorDto, VendorProductType } from '@/types';
import {
  VENDOR_PRODUCT_TYPES,
  VENDOR_PRODUCT_TYPE_LABELS,
} from '@/types/vendor';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { extractErrorMessage, type CreateVendorFormData } from './helpers';

export function AddVendorDialog({
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
              {errors.businessName && (
                <FieldError>{errors.businessName.message}</FieldError>
              )}
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
              {errors.contactPerson && (
                <FieldError>{errors.contactPerson.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-email">Email</FieldLabel>
              <Input
                id="vendor-email"
                type="email"
                {...register('contactEmail', {
                  required: 'Contact email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {errors.contactEmail && (
                <FieldError>{errors.contactEmail.message}</FieldError>
              )}
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
              {errors.productType && (
                <FieldError>{errors.productType.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-desc">Description</FieldLabel>
              <Input
                id="vendor-desc"
                {...register('description', {
                  maxLength: { value: 1000, message: 'Too long (max 1000)' },
                })}
              />
              {errors.description && (
                <FieldError>{errors.description.message}</FieldError>
              )}
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
