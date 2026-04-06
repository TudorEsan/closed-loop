import * as React from "react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
  CircleDollarSignIcon,
} from "lucide-react"
import { useAuth } from "@/lib/auth-provider"

const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Users",
    url: "/users",
    icon: <UsersIcon />,
  },
]

const navSecondary = [
  {
    title: "Settings",
    url: "/settings",
    icon: <Settings2Icon />,
  },
  {
    title: "Help",
    url: "/help",
    icon: <CircleHelpIcon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard">
                <CircleDollarSignIcon className="size-5!" />
                <span className="text-base font-semibold">Endow</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name || "Admin",
            email: user?.email || "",
            avatar: user?.image || "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
