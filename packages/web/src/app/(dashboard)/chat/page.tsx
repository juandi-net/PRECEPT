import { createClient } from '@/lib/supabase/server'
import { CeoChat } from '@/components/chat/ceo-chat'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: org } = await supabase.from('orgs').select('id').single()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">CEO Chat</h1>
      <CeoChat orgId={org?.id ?? ''} />
    </div>
  )
}
