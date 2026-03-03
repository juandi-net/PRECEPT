export interface BriefingBoardRequest {
  number: number;
  request: string;
  context: string;
  urgency: string;
  fallback: string;
}

export interface BriefingException {
  description: string;
  severity: 'critical' | 'warning' | 'info';
  initiative: string | null;
}

export interface BriefingInitiativeSummary {
  name: string;
  status: string;
  outcome_summary: string;
}

export interface BriefingResults {
  north_star: string | null;
  initiatives: BriefingInitiativeSummary[];
}

export interface BriefingContent {
  board_requests: BriefingBoardRequest[];
  exceptions: BriefingException[];
  results: BriefingResults;
  forward_look: string;
}

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
