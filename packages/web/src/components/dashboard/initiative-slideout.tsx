'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InitiativeDetail } from '@/components/initiative/initiative-detail'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface InitiativeSlideoutProps {
  initiativeId: string
  onClose: () => void
}

export function InitiativeSlideout({ initiativeId, onClose }: InitiativeSlideoutProps) {
  const [initiative, setInitiative] = useState<{
    id: string; name: string; status: string; phase_current: number; created_at: string
  } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('initiatives')
      .select('*')
      .eq('id', initiativeId)
      .single()
      .then(({ data }) => {
        if (data) setInitiative(data)
        else setError(true)
      })
  }, [initiativeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-full max-w-2xl overflow-y-auto border-r bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Initiative Detail</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-muted-foreground">Initiative not found.</p>
        ) : initiative ? (
          <InitiativeDetail initiative={initiative} />
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </div>
    </>
  )
}
