import { Pencil } from 'lucide-react';

import type { Event } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDate } from './helpers';

export function OverviewTab({
  event,
  onEditClick,
}: {
  event: Event;
  onEditClick: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{event.name}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs">{event.slug}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="max-w-[250px] text-right">
                {event.description || 'No description'}
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd>{event.location || 'Not set'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Start Date</dt>
              <dd>{formatDate(event.startDate)}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">End Date</dt>
              <dd>{formatDate(event.endDate)}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Timezone</dt>
              <dd>{event.timezone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{event.currency}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
