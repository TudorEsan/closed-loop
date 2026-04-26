import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import type { Event } from '@/types';
import { eventsService } from '@/services';
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
import {
  CURRENCIES,
  formatDateForInput,
  type EditEventFormData,
} from './helpers';

export function EditEventDialog({
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
          <DialogDescription>Update the event details below.</DialogDescription>
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
