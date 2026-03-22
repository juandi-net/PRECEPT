export const dynamic = "force-dynamic"

import { createClient } from '@/lib/supabase/server'
import { FIELD_LABELS, type CornerstoneDraft, type FieldState } from '@precept/shared'
import './cornerstone.css'

const STATE_MARKER: Record<FieldState, string> = {
  confirmed: '\u2713',
  hypothesis: '~',
  research_pending: '?',
  open_question: '\u25CB',
}

const SECTIONS: Array<{ title: string; fields: (keyof CornerstoneDraft)[] }> = [
  { title: 'Root & Identity', fields: ['root', 'identity', 'mission_statement', 'product_service', 'competitive_landscape'] },
  { title: 'Context', fields: ['stage', 'history', 'resources', 'constraints'] },
  { title: 'Strategy', fields: ['success_definition', 'active_priorities'] },
  { title: 'Operations', fields: ['data_policy'] },
]

export default async function CornerstonePage() {
  const supabase = await createClient()

  const { data: cornerstone } = await supabase
    .from('cornerstone')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const content = cornerstone?.content as CornerstoneDraft | null

  if (!content) {
    return (
      <div className="cornerstone-page">
        <p className="cornerstone-empty">No cornerstone loaded. Complete the onboarding flow first.</p>
      </div>
    )
  }

  return (
    <div className="cornerstone-page">
      <h1 className="cornerstone-title">Cornerstone</h1>
      {SECTIONS.map((section) => (
        <section key={section.title} className="cornerstone-section">
          <h2 className="cornerstone-section-title">{section.title}</h2>
          {section.fields.map((fieldName) => {
            const field = content[fieldName]
            if (!field) {
              return (
                <div key={fieldName} className="cornerstone-field cornerstone-field--empty">
                  <span className="cornerstone-label">{FIELD_LABELS[fieldName]}</span>
                  <span className="cornerstone-empty-note">Not yet discussed</span>
                </div>
              )
            }
            return (
              <div key={fieldName} className={`cornerstone-field cornerstone-field--${field.state}`}>
                <div className="cornerstone-field-header">
                  <span className="cornerstone-label">{FIELD_LABELS[fieldName]}</span>
                  <span className="cornerstone-state">{STATE_MARKER[field.state]}</span>
                </div>
                <p className="cornerstone-content">{field.content}</p>
                {field.notes && <p className="cornerstone-notes">Note: {field.notes}</p>}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
