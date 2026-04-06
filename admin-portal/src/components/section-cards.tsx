import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalendarIcon, UsersIcon, StoreIcon, ActivityIcon } from "lucide-react"
import type { Event } from "@/types"

export function SectionCards({ events }: { events: Event[] }) {
  const totalEvents = events.length
  const activeEvents = events.filter((e) => e.status === "active").length
  const draftEvents = events.filter((e) => e.status === "draft").length

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Events</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalEvents}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <CalendarIcon className="size-3" />
              All time
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {draftEvents} in draft
          </div>
          <div className="text-muted-foreground">
            Across all organizers
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Events</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeEvents}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-emerald-600">
              <ActivityIcon className="size-3" />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Currently running
          </div>
          <div className="text-muted-foreground">
            Accepting transactions
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Events in Setup</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {events.filter((e) => e.status === "setup").length}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <StoreIcon className="size-3" />
              Preparing
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Configuring vendors & team
          </div>
          <div className="text-muted-foreground">
            Ready to go live soon
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Closed / Settled</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {events.filter((e) => e.status === "closed" || e.status === "settlement").length}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <UsersIcon className="size-3" />
              Completed
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Past events
          </div>
          <div className="text-muted-foreground">
            Settlement done or in progress
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
