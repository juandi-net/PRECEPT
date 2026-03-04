import { createClient } from '@/lib/supabase/server'
import { InitiativeDetail } from '@/components/initiative/initiative-detail'
import { notFound } from 'next/navigation'

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('*')
    .eq('id', id)
    .single()

  if (!initiative) notFound()

  return <InitiativeDetail initiative={initiative} />
}
