'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOrg() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('orgs').select('id, name').single().then(({ data }) => {
      if (data) {
        setOrgId(data.id)
        setOrgName(data.name)
      }
    })
  }, [])

  return { orgId, orgName }
}
