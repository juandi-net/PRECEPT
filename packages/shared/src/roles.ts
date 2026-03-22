export type AgentTier = 'board' | 'leadership' | 'system' | 'execution';

export type SeparationPolicy = 'always' | 'high_stakes' | 'never';

export type TrustAutonomy = 'execute_only' | 'flag_and_execute' | 'propose' | 'autonomous_bounded';

/**
 * Trust autonomy spectrum — the system should grow toward higher autonomy as
 * models become more capable and the skill library matures:
 *
 * execute_only       — do exactly what's specified, nothing more
 * flag_and_execute   — do the task + report observations via field signals
 * propose            — suggest actions, wait for approval before executing
 * autonomous_bounded — act within defined constraints without approval
 *                      (e.g., "execute any research task under 30 min without approval,
 *                       flag anything over")
 *
 * When SOTA runs on iPhone, workers should eventually reach 'autonomous_bounded'
 * for well-understood task types with mature skills. The organizational knowledge
 * and Precepts alignment — not model capability — become the trust gatekeepers.
 */

export interface RoleConfig {
  id: string;
  orgId: string;
  role: string;
  tier: AgentTier;
  modelTier: string;                // 'opus' | 'sonnet' today, any model ID when SOTA is universal
  modelOverride: string | null;
  endpointOverride: string | null;  // override default CLIProxy URL (multi-device routing)
  contextIncludes: string[];
  contextExcludes: string[];
  evaluationPath: string | null;
  escalationTarget: string | null;
  separationPolicy: SeparationPolicy;
  trustAutonomy: TrustAutonomy;
  createdAt: string;
  updatedAt: string | null;
}

/** Tier behavior definitions — the engine uses these, not role names */
export const TIER_BEHAVIORS = {
  board: {
    requiresEvaluation: false,
    canEscalateTo: null,      // board is the top
    canApproveWork: true,
    runsOnSchedule: false,
  },
  leadership: {
    requiresEvaluation: false, // leadership roles don't go through reviewer/judge
    canEscalateTo: 'board' as const,
    canApproveWork: true,
    runsOnSchedule: true,      // CEO weekly cycle, Advisor weekly
  },
  system: {
    requiresEvaluation: false, // Scribe and Curator skip eval pipeline
    canEscalateTo: 'leadership' as const,
    canApproveWork: false,
    runsOnSchedule: true,      // Scribe on planning cycle, Curator weekly
  },
  execution: {
    requiresEvaluation: true,  // Workers always go through eval gates
    canEscalateTo: 'leadership' as const,
    canApproveWork: false,
    runsOnSchedule: false,     // Workers are event-driven (dispatched)
  },
} as const;

export type TierBehavior = (typeof TIER_BEHAVIORS)[AgentTier];

/**
 * Owner time budget — the permanent scarce resource.
 *
 * When inference is free (SOTA on iPhone), compute budget = 0. But owner time
 * is always finite. The CEO's primary job is to maximize return on every minute
 * the owner spends with the system.
 *
 * This replaces all "compute budget" language in the system.
 */
export interface OwnerTimeBudget {
  dailyMinutes: number;            // target: 30 min/day
  boardRequestCostMinutes: number; // estimated cost per Board Request: ~5 min
  signOffCostMinutes: number;      // estimated cost per Sign-Off: ~3 min
  briefingCostMinutes: number;     // estimated cost per briefing review: ~10 min
  deepReviewCostMinutes: number;   // estimated cost per inspect-page deep review: ~15 min
  maxBoardRequestsPerCycle: number; // hard ceiling: 2
}

export const DEFAULT_TIME_BUDGET: OwnerTimeBudget = {
  dailyMinutes: 30,
  boardRequestCostMinutes: 5,
  signOffCostMinutes: 3,
  briefingCostMinutes: 10,
  deepReviewCostMinutes: 15,
  maxBoardRequestsPerCycle: 2,
};
