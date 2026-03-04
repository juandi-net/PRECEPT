import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const mission = (precepts?.content as Record<string, Record<string, string>> | null)
    ?.identity?.mission_statement ?? null

  const { data: org } = await supabase.from('orgs').select('id').single()

  return <DashboardClient mission={mission} orgId={org?.id ?? ''} />
}
