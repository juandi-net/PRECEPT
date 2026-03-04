'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BoardRequests } from './board-requests'
import { InitiativeCards } from './initiative-cards'
import { Exceptions } from './exceptions'

interface DashboardClientProps {
  mission: string | null
  orgId: string
}

export function DashboardClient({ mission, orgId }: DashboardClientProps) {
  return (
    <div className="space-y-8">
      {mission && (
        <Card className="border-none bg-muted/50">
          <CardContent className="py-4">
            <p className="text-center text-lg font-medium text-muted-foreground">{mission}</p>
          </CardContent>
        </Card>
      )}

      <BoardRequests orgId={orgId} />
      <InitiativeCards orgId={orgId} />
      <Exceptions orgId={orgId} />

      {/* Empty state is handled implicitly: when all three sections return null,
          only the mission banner shows — silence means success */}
    </div>
  )
}
