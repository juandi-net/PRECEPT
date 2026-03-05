'use client'

import { useState } from 'react'
import { InitiativeCards } from './initiative-cards'
import { BoardRequests } from './board-requests'
import { Exceptions } from './exceptions'
import { InitiativeSlideout } from './initiative-slideout'
import { AuditLog } from '@/components/audit/audit-log'
import { CeoChat } from '@/components/chat/ceo-chat'
import { OrgChart } from '@/components/structure/org-chart'

interface CommandCenterProps {
  orgId: string
}

export function CommandCenter({ orgId }: CommandCenterProps) {
  const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null)

  return (
    <>
      <div className="grid h-full grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.6fr_1.4fr]">
        {/* Left Column */}
        <div className="flex flex-col gap-0 overflow-y-auto border-r p-4 xl:order-none order-3">
          <InitiativeCards orgId={orgId} onSelect={setSelectedInitiative} />
          <div className="mt-4 hidden xl:block min-h-[300px] flex-1">
            <OrgChart orgId={orgId} compact />
          </div>
        </div>

        {/* Center Column */}
        <div className="flex flex-col overflow-hidden border-r xl:order-none order-4">
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Activity Feed
            </h2>
            <AuditLog orgId={orgId} />
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col overflow-hidden xl:order-none order-1">
          {/* CEO Chat — takes majority of right column */}
          <div className="flex-1 min-h-0">
            <CeoChat orgId={orgId} />
          </div>

          {/* Board Requests + Exceptions — compact, only if present */}
          <div className="shrink-0 space-y-4 border-t p-4">
            <BoardRequests orgId={orgId} />
            <Exceptions orgId={orgId} />
          </div>
        </div>
      </div>

      {/* Initiative slide-out */}
      {selectedInitiative && (
        <InitiativeSlideout
          initiativeId={selectedInitiative}
          onClose={() => setSelectedInitiative(null)}
        />
      )}
    </>
  )
}
