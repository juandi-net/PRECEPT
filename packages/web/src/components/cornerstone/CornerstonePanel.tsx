'use client';

import { CORNERSTONE_FIELDS, FIELD_LABELS, type CornerstoneDraft, type CornerstoneFieldName, type CornerstoneField, type FieldState } from '@precept/shared';

const STATE_LABELS: Record<FieldState, string> = {
  confirmed: 'Confirmed',
  hypothesis: 'Hypothesis',
  research_pending: 'Research Pending',
  open_question: 'Open Question',
};

interface CornerstonePanelProps {
  draft: CornerstoneDraft;
  expanded?: boolean;
  onEdit?: (fieldName: CornerstoneFieldName, updates: Partial<CornerstoneField>) => void;
}

function CornerstoneFieldRow({ fieldName, field }: { fieldName: CornerstoneFieldName; field: CornerstoneField | null }) {
  const label = FIELD_LABELS[fieldName];

  if (!field) {
    return (
      <div className="precept-field precept-field--empty">
        <div className="precept-field-label">{label}</div>
        <div className="precept-field-content">Not yet discussed</div>
      </div>
    );
  }

  return (
    <div className="precept-field">
      <div className="precept-field-header">
        <span className="precept-field-label">{label}</span>
        <span className={`precept-field-state precept-field-state--${field.state}`}>
          {STATE_LABELS[field.state]}
        </span>
      </div>
      <div className="precept-field-content">{field.content}</div>
      {field.notes && (
        <div className="precept-field-notes">{field.notes}</div>
      )}
    </div>
  );
}

export function CornerstonePanel({ draft }: CornerstonePanelProps) {
  const filledCount = CORNERSTONE_FIELDS.filter((f) => draft[f] != null).length;

  return (
    <div>
      <div className="precepts-header">
        <h2>Cornerstone</h2>
        <div className="precepts-header-count">
          {filledCount} of {CORNERSTONE_FIELDS.length} fields
        </div>
      </div>
      <div className="precepts-list">
        {CORNERSTONE_FIELDS.map((fieldName) => (
          <CornerstoneFieldRow
            key={fieldName}
            fieldName={fieldName}
            field={draft[fieldName] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
