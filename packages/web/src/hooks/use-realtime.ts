'use client'

import { useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseRealtimeOptions {
  table: string
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

export function useRealtime({ table, filter, event = '*', onPayload }: UseRealtimeOptions) {
  const id = useId()
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`${table}-${id}`)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        onPayload
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, filter, event]) // onPayload intentionally excluded — wrap in useCallback at call site
}
