import { createClient } from '@/lib/supabase/server'
import { AuditLog } from '@/components/audit/audit-log'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('orgs').select('id').single()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Audit Log</h1>
      <AuditLog orgId={org?.id ?? ''} />
    </div>
  )
}
