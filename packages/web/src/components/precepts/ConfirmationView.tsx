'use client';

import { useState } from 'react';
import {
  PRECEPTS_FIELDS,
  FIELD_LABELS,
  type PreceptsDraft,
  type PreceptsFieldName,
  type PreceptsField,
  type FieldState,
} from '@precept/shared';

interface ConfirmationViewProps {
  draft: PreceptsDraft;
  onLockAndLaunch: (editedDraft: PreceptsDraft) => void;
  isLaunching: boolean;
}

const STATE_OPTIONS: { value: FieldState; label: string; color: string }[] = [
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
  { value: 'hypothesis', label: 'Hypothesis', color: 'bg-yellow-500' },
  { value: 'research_pending', label: 'Research Pending', color: 'bg-orange-500' },
  { value: 'open_question', label: 'Open Question', color: 'bg-red-500' },
];

export function ConfirmationView({ draft, onLockAndLaunch, isLaunching }: ConfirmationViewProps) {
  const [localDraft, setLocalDraft] = useState<PreceptsDraft>({ ...draft });

  const updateField = (fieldName: PreceptsFieldName, updates: Partial<PreceptsField>) => {
    const current = localDraft[fieldName];
    if (!current) return;
    setLocalDraft({
      ...localDraft,
      [fieldName]: { ...current, ...updates },
    });
  };

  const filledFields = PRECEPTS_FIELDS.filter((f) => localDraft[f] != null);
  const emptyFields = PRECEPTS_FIELDS.filter((f) => localDraft[f] == null);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900">Review Your Precepts</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Green = confirmed. Yellow = hypothesis to test. Orange = needs research. Red = your call to make.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filledFields.map((fieldName) => {
          const field = localDraft[fieldName]!;
          return (
            <div key={fieldName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">{FIELD_LABELS[fieldName]}</h3>
                <select
                  value={field.state}
                  onChange={(e) => updateField(fieldName, { state: e.target.value as FieldState })}
                  className="text-xs border rounded px-2 py-1"
                >
                  {STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={field.content}
                onChange={(e) => updateField(fieldName, { content: e.target.value })}
                className="w-full text-sm border rounded-lg p-3 min-h-[60px] focus:outline-none focus:border-neutral-500"
              />
              <input
                type="text"
                value={field.notes || ''}
                onChange={(e) => updateField(fieldName, { notes: e.target.value || null })}
                placeholder="Add a note..."
                className="w-full text-xs border rounded-lg px-3 py-2 mt-2 text-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
          );
        })}

        {emptyFields.length > 0 && (
          <div className="border border-dashed rounded-lg p-4">
            <p className="text-sm text-neutral-400">
              Not yet discussed: {emptyFields.map((f) => FIELD_LABELS[f]).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-neutral-200">
        <button
          onClick={() => onLockAndLaunch(localDraft)}
          disabled={isLaunching}
          className="w-full rounded-xl bg-neutral-900 py-4 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLaunching ? 'Launching...' : 'Lock & Launch'}
        </button>
        <p className="text-xs text-neutral-400 text-center mt-2">
          This finalizes your Precepts and starts the system. Incomplete fields become research tasks.
        </p>
      </div>
    </div>
  );
}
