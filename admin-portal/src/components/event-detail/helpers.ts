import { useEffect, useState } from 'react';
import type { EventStatus, VendorStatus } from '@/types';

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateForInput(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const STATUS_TRANSITIONS: Record<EventStatus, EventStatus | null> = {
  draft: 'setup',
  setup: 'active',
  active: 'settlement',
  settlement: 'closed',
  closed: null,
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  setup: 'Setup',
  active: 'Active',
  settlement: 'Settlement',
  closed: 'Closed',
};

export const STATUS_BADGE_CONFIG: Record<
  EventStatus,
  { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  draft: { variant: 'secondary' },
  setup: {
    variant: 'outline',
    className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  },
  active: { variant: 'default', className: 'bg-emerald-600 text-white' },
  settlement: {
    variant: 'outline',
    className: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  },
  closed: { variant: 'destructive' },
};

export function vendorStatusBadgeVariant(status: VendorStatus) {
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

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (typeof anyErr.message === 'string') return anyErr.message;
  }
  return fallback;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export type EditEventFormData = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
};

export type CreateVendorFormData = {
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  productType: import('@/types').VendorProductType | '';
  description: string;
};
