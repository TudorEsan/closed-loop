import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { ActivityIcon } from 'lucide-react';

import type { EventTransactionSummary } from '@/types';
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

const chartConfig = {
  salesVolume: {
    label: 'Sales',
    color: 'var(--primary)',
  },
  transactionCount: {
    label: 'Transactions',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

type ChartMode = 'salesVolume' | 'transactionCount';

export function TransactionChart({
  summary,
}: {
  summary?: EventTransactionSummary;
}) {
  const [timeRange, setTimeRange] = useState('all');
  const [chartMode, setChartMode] = useState<ChartMode>('salesVolume');
  const allData = summary?.buckets ?? [];

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
            No transaction data available yet. Data will appear after real
            payments are recorded.
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
          {chartMode === 'salesVolume'
            ? 'Sales Volume'
            : 'Number of Transactions'}
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {chartMode === 'salesVolume'
              ? `Completed sales in ${summary?.currency ?? ''} over time`
              : 'Transaction count over time'}
          </span>
          <span className="@[540px]/card:hidden">
            {chartMode === 'salesVolume' ? summary?.currency : 'Count'}
          </span>
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={chartMode}
              onValueChange={(v) => v && setChartMode(v as ChartMode)}
              variant="outline"
              className="hidden @[600px]/card:flex"
            >
              <ToggleGroupItem value="salesVolume" className="px-3 text-xs">
                Sales
              </ToggleGroupItem>
              <ToggleGroupItem
                value="transactionCount"
                className="px-3 text-xs"
              >
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
              <SelectTrigger
                className="flex w-24 @[767px]/card:hidden"
                size="sm"
              >
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
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-salesVolume)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-salesVolume)"
                  stopOpacity={0.1}
                />
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
              stroke="var(--color-salesVolume)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
