export interface CeoChatMessage {
  id: string
  org_id: string
  role: 'owner' | 'ceo'
  content: string
  created_at: string
}
