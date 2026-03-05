/** The CEO's letter — plain text with markdown links. */
export type BriefingLetter = string;

export type OwnerReplyAction =
  | { type: 'approve'; target_id: string }
  | { type: 'hold'; target_id: string }
  | { type: 'pivot'; target_id: string; direction: string }
  | { type: 'free_text'; content: string }
  | { type: 'clarify'; question: string };

export interface OwnerReplyIntent {
  actions: OwnerReplyAction[];
  raw_text: string;
}
