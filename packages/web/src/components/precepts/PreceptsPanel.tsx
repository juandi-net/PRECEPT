'use client';

import { PRECEPTS_FIELDS, type PreceptsDraft, type PreceptsFieldName, type PreceptsField } from '@precept/shared';
import { PreceptField } from './PreceptField';

interface PreceptsPanelProps {
  draft: PreceptsDraft;
  expanded?: boolean;
  onEdit?: (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => void;
}

export function PreceptsPanel({ draft, expanded, onEdit }: PreceptsPanelProps) {
  const filledCount = PRECEPTS_FIELDS.filter((f) => draft[f] != null).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900">Precepts</h2>
        <p className="text-xs text-neutral-500 mt-1">
          {filledCount} of {PRECEPTS_FIELDS.length} fields populated
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {PRECEPTS_FIELDS.map((fieldName) => (
          <PreceptField
            key={fieldName}
            fieldName={fieldName}
            field={draft[fieldName] ?? null}
            expanded={expanded}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
