'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from './theme-provider'
import { FileText, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  orgName: string
  mission: string | null
}

export function TopBar({ orgName, mission }: TopBarProps) {
  const [connected, setConnected] = useState(true)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('connection-health').subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-4">
      {/* Left: org name + live indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide">{orgName}</span>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-muted-foreground">
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
      </div>

      {/* Center: mission */}
      {mission && (
        <p className="flex-1 truncate text-center text-sm text-muted-foreground" title={mission}>
          {mission}
        </p>
      )}
      {!mission && <div className="flex-1" />}

      {/* Right: theme toggle + precepts link */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Link href="/precepts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <FileText className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  )
}
