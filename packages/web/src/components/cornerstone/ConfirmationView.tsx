'use client';

import { useState } from 'react';
import {
  CORNERSTONE_FIELDS,
  FIELD_LABELS,
  type CornerstoneDraft,
  type CornerstoneFieldName,
  type CornerstoneField,
  type FieldState,
} from '@precept/shared';

interface ConfirmationViewProps {
  draft: CornerstoneDraft;
  onLockAndLaunch: (editedDraft: CornerstoneDraft) => void;
  isLaunching: boolean;
}

const STATE_LABELS: Record<FieldState, string> = {
  confirmed: 'Confirmed',
  hypothesis: 'Hypothesis',
  research_pending: 'Research Pending',
  open_question: 'Open Question',
};

export function ConfirmationView({ draft, onLockAndLaunch, isLaunching }: ConfirmationViewProps) {
  const [localDraft, setLocalDraft] = useState<CornerstoneDraft>({ ...draft });

  const updateField = (fieldName: CornerstoneFieldName, updates: Partial<CornerstoneField>) => {
    const current = localDraft[fieldName];
    if (!current) return;
    setLocalDraft({
      ...localDraft,
      [fieldName]: { ...current, ...updates },
    });
  };

  return (
    <div className="confirmation-page">
      <h1 className="confirmation-title">Review your Cornerstone</h1>
      <p className="confirmation-subtitle">
        Edit anything. Then lock and launch.
      </p>

      {CORNERSTONE_FIELDS.map((fieldName) => {
        const field = localDraft[fieldName];
        if (!field) return null;
        return (
          <div key={fieldName} className="confirmation-field">
            <div className="confirmation-field-label">
              {FIELD_LABELS[fieldName]}
              <span className={`confirmation-field-state precept-field-state--${field.state}`}>
                {STATE_LABELS[field.state]}
              </span>
            </div>
            <textarea
              className="confirmation-textarea"
              value={field.content}
              onChange={(e) => updateField(fieldName, { content: e.target.value })}
            />
          </div>
        );
      })}

      <button
        className="confirmation-launch"
        onClick={() => onLockAndLaunch(localDraft)}
        disabled={isLaunching}
      >
        {isLaunching ? 'Launching...' : 'Lock & Launch'}
      </button>
      <p className="confirmation-hint">
        This finalizes your Cornerstone and starts the system. Incomplete fields become research tasks.
      </p>
    </div>
  );
}
