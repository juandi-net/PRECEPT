'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Network, MessageSquare, ScrollText, FileText } from 'lucide-react'
import { EngineStatus } from './engine-status'

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Structure', url: '/structure', icon: Network },
  { title: 'CEO Chat', url: '/chat', icon: MessageSquare },
  { title: 'Audit Log', url: '/audit', icon: ScrollText },
  { title: 'Precepts', url: '/precepts', icon: FileText },
]

export function AppSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <p className="text-lg font-semibold">{orgName}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <EngineStatus />
      </SidebarFooter>
    </Sidebar>
  )
}
