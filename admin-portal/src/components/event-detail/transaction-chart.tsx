import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { ActivityIcon } from 'lucide-react';

import type { Event } from '@/types';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function generateMockChartData(event: Event) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const now = new Date();
  const effectiveEnd = end < now ? end : now;

  if (start > now || event.status === 'draft' || event.status === 'setup') {
    return [];
  }

  const data: { date: string; volume: number; transactions: number }[] = [];
  const current = new Date(start);

  while (current <= effectiveEnd) {
    const hour = current.getHours();
    const isDay = hour >= 10 && hour <= 23;
    const base = isDay ? 150 + Math.random() * 350 : 10 + Math.random() * 40;
    const txCount = isDay ? 20 + Math.floor(Math.random() * 80) : Math.floor(Math.random() * 10);

    data.push({
      date: current.toISOString(),
      volume: Math.round(base * 100) / 100,
      transactions: txCount,
    });

    current.setHours(current.getHours() + 4);
  }

  return data;
}

const chartConfig = {
  volume: {
    label: 'Volume',
    color: 'var(--primary)',
  },
  transactions: {
    label: 'Transactions',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function TransactionChart({ event }: { event: Event }) {
  const [timeRange, setTimeRange] = useState('all');
  const [chartMode, setChartMode] = useState<'volume' | 'transactions'>('volume');
  const allData = generateMockChartData(event);

  const filteredData = allData.filter((item) => {
    if (timeRange === 'all') return true;
    const date = new Date(item.date);
    const ref = new Date(allData[allData.length - 1]?.date ?? new Date());
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(ref);
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  });

  if (allData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Volume</CardTitle>
          <CardDescription>
            No transaction data available yet. Data will appear once the event goes live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ActivityIcon className="mx-auto mb-2 size-8 opacity-40" />
              <p className="text-sm">Waiting for transactions...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          {chartMode === 'volume' ? 'Transaction Volume' : 'Number of Transactions'}
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {chartMode === 'volume'
              ? `Total volume in ${event.currency} over time`
              : 'Transaction count over time'}
          </span>
          <span className="@[540px]/card:hidden">
            {chartMode === 'volume' ? event.currency : 'Count'}
          </span>
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={chartMode}
              onValueChange={(v) => v && setChartMode(v as 'volume' | 'transactions')}
              variant="outline"
              className="hidden @[600px]/card:flex"
            >
              <ToggleGroupItem value="volume" className="px-3 text-xs">
                Volume
              </ToggleGroupItem>
              <ToggleGroupItem value="transactions" className="px-3 text-xs">
                Transactions
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(v) => v && setTimeRange(v)}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:px-3! @[767px]/card:flex"
            >
              <ToggleGroupItem value="7d">7d</ToggleGroupItem>
              <ToggleGroupItem value="30d">30d</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="flex w-24 @[767px]/card:hidden" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-volume)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-volume)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey={chartMode}
              type="natural"
              fill="url(#fillChart)"
              stroke="var(--color-volume)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
