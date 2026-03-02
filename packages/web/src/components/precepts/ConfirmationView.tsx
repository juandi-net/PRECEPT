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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ConfirmationViewProps {
  draft: PreceptsDraft;
  onLockAndLaunch: (editedDraft: PreceptsDraft) => void;
  isLaunching: boolean;
}

const STATE_OPTIONS: { value: FieldState; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'hypothesis', label: 'Hypothesis' },
  { value: 'research_pending', label: 'Research Pending' },
  { value: 'open_question', label: 'Open Question' },
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
                <Select
                  value={field.state}
                  onValueChange={(value) => updateField(fieldName, { state: value as FieldState })}
                >
                  <SelectTrigger size="sm" className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={field.content}
                onChange={(e) => updateField(fieldName, { content: e.target.value })}
                className="min-h-[60px]"
              />
              <Input
                type="text"
                value={field.notes || ''}
                onChange={(e) => updateField(fieldName, { notes: e.target.value || null })}
                placeholder="Add a note..."
                className="mt-2 text-xs text-muted-foreground"
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
        <Button
          onClick={() => onLockAndLaunch(localDraft)}
          disabled={isLaunching}
          size="lg"
          className="w-full rounded-xl py-6 text-base font-semibold"
        >
          {isLaunching ? 'Launching...' : 'Lock & Launch'}
        </Button>
        <p className="text-xs text-neutral-400 text-center mt-2">
          This finalizes your Precepts and starts the system. Incomplete fields become research tasks.
        </p>
      </div>
    </div>
  );
}
