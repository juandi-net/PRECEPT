import { createClient } from '@/lib/supabase/server'
import { OrgChart } from '@/components/structure/org-chart'

export default async function StructurePage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('orgs').select('id').single()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Structure</h1>
      <OrgChart orgId={org?.id ?? ''} />
    </div>
  )
}
