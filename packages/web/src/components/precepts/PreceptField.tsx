import type { PreceptsField, FieldState } from '@precept/shared';
import { FIELD_LABELS, type PreceptsFieldName } from '@precept/shared';

interface PreceptFieldProps {
  fieldName: PreceptsFieldName;
  field: PreceptsField | null;
  expanded?: boolean;
  onEdit?: (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => void;
}

const STATE_COLORS: Record<FieldState, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  hypothesis: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  research_pending: 'bg-orange-100 text-orange-800 border-orange-200',
  open_question: 'bg-red-100 text-red-800 border-red-200',
};

const STATE_LABELS: Record<FieldState, string> = {
  confirmed: 'Confirmed',
  hypothesis: 'Hypothesis',
  research_pending: 'Research Pending',
  open_question: 'Open Question',
};

const STATE_INDICATORS: Record<FieldState, string> = {
  confirmed: '\u2713',
  hypothesis: '~',
  research_pending: '?',
  open_question: '\u25CB',
};

export function PreceptField({ fieldName, field }: PreceptFieldProps) {
  const label = FIELD_LABELS[fieldName];

  if (!field) {
    return (
      <div className="border border-dashed border-neutral-200 rounded-lg p-3 opacity-50">
        <p className="text-xs font-medium text-neutral-400">{label}</p>
        <p className="text-xs text-neutral-300 mt-1">Not yet discussed</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${STATE_COLORS[field.state]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium">{label}</p>
        <span className="text-xs font-mono">
          {STATE_INDICATORS[field.state]} {STATE_LABELS[field.state]}
        </span>
      </div>
      <p className="text-sm mt-1">{field.content}</p>
      {field.notes && (
        <p className="text-xs mt-2 opacity-75 italic">Note: {field.notes}</p>
      )}
    </div>
  );
}
