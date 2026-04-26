import {
  ActivityIcon,
  StoreIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';

import type { Event } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { STATUS_LABELS } from './helpers';
import { generateMockChartData } from './transaction-chart';

export function EventStatsCards({
  event,
  vendorCount,
  memberCount,
}: {
  event: Event;
  vendorCount: number;
  memberCount: number;
}) {
  const chartData = generateMockChartData(event);
  const totalVolume = chartData.reduce((sum, d) => sum + d.volume, 0);
  const totalTx = chartData.reduce((sum, d) => sum + d.transactions, 0);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Volume</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalVolume > 0
              ? `${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${event.currency}`
              : 'N/A'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <WalletIcon className="size-3" />
              {event.status === 'active' ? 'Live' : STATUS_LABELS[event.status]}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalVolume > 0 ? (
              <>
                <TrendingUpIcon className="size-4" />
                Token rate: {event.tokenCurrencyRate}
              </>
            ) : (
              'No transactions yet'
            )}
          </div>
          <div className="text-muted-foreground">Currency: {event.currency}</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Transactions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalTx > 0 ? totalTx.toLocaleString() : 'N/A'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={event.status === 'active' ? 'text-emerald-600' : ''}>
              <ActivityIcon className="size-3" />
              {event.status === 'active' ? 'Processing' : 'Idle'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalTx > 0 ? 'All transaction types' : 'Waiting for activity'}
          </div>
          <div className="text-muted-foreground">Top-ups, purchases, refunds</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Vendors</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {vendorCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <StoreIcon className="size-3" />
              Registered
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Accepting payments</div>
          <div className="text-muted-foreground">Food, drinks, merchandise</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Team Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {memberCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UsersIcon className="size-3" />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Managing the event</div>
          <div className="text-muted-foreground">Organizers, admins, operators</div>
        </CardFooter>
      </Card>
    </div>
  );
}
