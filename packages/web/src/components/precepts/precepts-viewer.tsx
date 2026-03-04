import { PRECEPTS_FIELDS, type PreceptsDraft, type PreceptsFieldName } from '@precept/shared'
import { PreceptField } from './PreceptField'

const SECTIONS: Array<{ title: string; fields: PreceptsFieldName[] }> = [
  {
    title: 'Identity & Product',
    fields: ['identity', 'product_service', 'competitive_landscape'],
  },
  {
    title: 'Context',
    fields: ['stage', 'history', 'resources', 'constraints'],
  },
  {
    title: 'Strategy',
    fields: ['success_definition', 'active_priorities'],
  },
  {
    title: 'Operations',
    fields: ['data_policy'],
  },
]

export function PreceptsViewer({ content }: { content: PreceptsDraft | null }) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground">
        No precepts loaded. Complete the onboarding flow first.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.fields.map((fieldName) => (
              <PreceptField
                key={fieldName}
                fieldName={fieldName}
                field={content[fieldName] ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
