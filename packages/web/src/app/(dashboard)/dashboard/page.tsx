import { createClient } from '@/lib/supabase/server'
import { CommandCenter } from '@/components/dashboard/command-center'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('orgs').select('id').single()

  return <CommandCenter orgId={org?.id ?? ''} />
}
