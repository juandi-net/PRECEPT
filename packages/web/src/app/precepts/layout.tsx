import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/top-bar'

export default async function PreceptsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .single()

  const { data: precepts } = await supabase
    .from('precepts')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const mission = (precepts?.content as Record<string, Record<string, string>> | null)
    ?.identity?.mission_statement ?? null

  return (
    <div className="flex h-screen flex-col">
      <TopBar orgName={org?.name ?? 'PRECEPT'} mission={mission} />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
