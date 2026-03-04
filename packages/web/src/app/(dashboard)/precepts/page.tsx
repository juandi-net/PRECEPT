import { createClient } from '@/lib/supabase/server'
import { PreceptsViewer } from '@/components/precepts/precepts-viewer'

export default async function PreceptsPage() {
  const supabase = await createClient()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Precepts</h1>
      <PreceptsViewer content={precepts?.content ?? null} />
    </div>
  )
}
