import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../onboarding.js';

// Mock the AI client
vi.mock('../../ai/client.js', () => ({
  ai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODELS: { opus: 'test-model', sonnet: 'test-model-sonnet' },
}));

// Mock the DB
vi.mock('../../db/onboarding.js', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('../../db/precepts.js', () => ({
  createPrecepts: vi.fn(),
}));

vi.mock('../../db/audit.js', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../skills.js', () => ({
  SeedSkillService: vi.fn().mockImplementation(() => ({
    generateSeedSkills: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@precept/shared', async () => {
  const actual = await vi.importActual('@precept/shared');
  return {
    ...actual,
    extractText: vi.fn().mockResolvedValue('extracted text content'),
  };
});

import { ai } from '../../ai/client.js';
import * as onboardingDb from '../../db/onboarding.js';
import * as preceptsDb from '../../db/precepts.js';
import * as auditDb from '../../db/audit.js';

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OnboardingService();
  });

  describe('startSession', () => {
    it('creates a session, calls the CEO, and returns opening message', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      vi.mocked(onboardingDb.createSession).mockResolvedValue(mockSession);

      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              message: "Hello! I'm your new CEO. Tell me about your business.",
              updatedTracker: mockSession.extractionTracker,
              updatedFields: {},
            }),
          },
          index: 0,
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      } as any);

      const result = await service.startSession();

      expect(result.sessionId).toBe('session-1');
      expect(result.message).toContain("I'm your new CEO");
      expect(onboardingDb.createSession).toHaveBeenCalled();
      expect(auditDb.logEvent).toHaveBeenCalledWith(
        'onboarding.session_started',
        'ceo-onboarding',
        expect.any(Object)
      );
    });

    it('stores rawResponse on the CEO conversation message', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      const rawJson = JSON.stringify({
        message: "Hello! I'm your new CEO.",
        updatedTracker: mockSession.extractionTracker,
        updatedFields: {},
      });

      vi.mocked(onboardingDb.createSession).mockResolvedValue(mockSession);
      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: rawJson }, index: 0, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      } as any);

      await service.startSession();

      const updateCall = vi.mocked(onboardingDb.updateSession).mock.calls[0];
      const savedConversation = updateCall[1].conversation!;
      expect(savedConversation[0].rawResponse).toBe(rawJson);
    });
  });

  describe('sendMessage', () => {
    it('appends owner message, calls CEO, updates session state', async () => {
      const existingSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [
          { role: 'ceo' as const, content: 'Hello!', timestamp: new Date().toISOString() },
        ],
        preceptsDraft: {} as any,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      vi.mocked(onboardingDb.getSession).mockResolvedValue(existingSession);

      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              message: "Interesting! Tell me more about what makes it unique.",
              updatedTracker: {
                ...existingSession.extractionTracker,
                coveredTopics: ['business_overview'],
                fieldsExtracted: ['identity'],
                fieldsRemaining: existingSession.extractionTracker.fieldsRemaining.filter(f => f !== 'identity'),
                activeThread: 'identity_deep_dive',
              },
              updatedFields: {
                identity: {
                  name: 'identity',
                  content: 'A SaaS platform for...',
                  state: 'hypothesis',
                  notes: null,
                },
              },
            }),
          },
          index: 0,
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 },
      } as any);

      const result = await service.sendMessage('session-1', 'We build software for small businesses.');

      expect(result.message).toContain('unique');
      expect(result.preceptsDraft.identity).toBeDefined();
      expect(result.preceptsDraft.identity?.state).toBe('hypothesis');
      expect(onboardingDb.updateSession).toHaveBeenCalled();
    });

    it('stores rawResponse on the CEO reply message', async () => {
      const existingSession = {
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [
          { role: 'ceo' as const, content: 'Hello!', timestamp: new Date().toISOString() },
        ],
        preceptsDraft: {} as any,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: [
            'identity', 'product_service', 'stage', 'success_definition',
            'resources', 'constraints', 'competitive_landscape', 'history',
            'active_priorities', 'data_policy',
          ],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      vi.mocked(onboardingDb.getSession).mockResolvedValue(existingSession);

      const rawJson = JSON.stringify({
        message: "Tell me more!",
        updatedTracker: {
          ...existingSession.extractionTracker,
          fieldsExtracted: ['identity'],
        },
        updatedFields: {
          identity: { name: 'identity', content: 'A cool biz', state: 'hypothesis', notes: null },
        },
      });

      vi.mocked(ai.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: rawJson }, index: 0, finish_reason: 'stop' }],
        usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 },
      } as any);

      await service.sendMessage('session-1', 'We build stuff.');

      const updateCall = vi.mocked(onboardingDb.updateSession).mock.calls[0];
      const savedConversation = updateCall[1].conversation!;
      // CEO reply is the last message in the conversation
      const ceoReply = savedConversation[savedConversation.length - 1];
      expect(ceoReply.rawResponse).toBe(rawJson);
    });
  });

  describe('completeSession', () => {
    it('creates precepts from edited draft and logs confirmation edits', async () => {
      const ceoDraft = {
        identity: {
          name: 'identity' as const,
          content: 'Original CEO content',
          state: 'hypothesis' as const,
          notes: null,
        },
        product_service: null,
        stage: null,
        success_definition: null,
        resources: null,
        constraints: null,
        competitive_landscape: null,
        history: null,
        active_priorities: null,
        data_policy: null,
      };

      const ownerDraft = {
        ...ceoDraft,
        identity: {
          name: 'identity' as const,
          content: 'Owner edited content',
          state: 'confirmed' as const,
          notes: 'Reviewed and confirmed',
        },
      };

      vi.mocked(onboardingDb.getSession).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: ceoDraft,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 6,
          fieldsExtracted: ['identity'],
          fieldsRemaining: [],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      vi.mocked(preceptsDb.createPrecepts).mockResolvedValue({
        id: 'precepts-1',
        sessionId: 'session-1',
        version: 1,
        content: ownerDraft,
        classification: 'internal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await service.completeSession('session-1', ownerDraft);

      expect(result.preceptsId).toBe('precepts-1');
      expect(preceptsDb.createPrecepts).toHaveBeenCalledWith('session-1', ownerDraft);

      // Should log confirmation edits
      expect(auditDb.logEvent).toHaveBeenCalledWith(
        'onboarding.confirmation_edits',
        'ceo-onboarding',
        expect.objectContaining({
          sessionId: 'session-1',
          contentChanges: expect.arrayContaining(['identity']),
          stateChanges: expect.arrayContaining(['identity']),
        })
      );
    });
  });

  describe('addDocuments', () => {
    it('extracts text from files and appends to session', async () => {
      vi.mocked(onboardingDb.getSession).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress' as const,
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: {
          coveredTopics: [],
          currentPhase: 1,
          fieldsExtracted: [],
          fieldsRemaining: ['identity'],
          activeThread: null,
        },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      const result = await service.addDocuments('session-1', [
        { buffer: Buffer.from('My business plan'), filename: 'plan.txt', mimeType: 'text/plain' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('plan.txt');
      expect(result[0].content).toBe('extracted text content');
      expect(onboardingDb.updateSession).toHaveBeenCalledWith('session-1', {
        contextDocuments: expect.arrayContaining([
          expect.objectContaining({ filename: 'plan.txt' }),
        ]),
      });
    });

    it('throws on unsupported MIME type', async () => {
      vi.mocked(onboardingDb.getSession).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
        contextDocuments: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      await expect(
        service.addDocuments('session-1', [
          { buffer: Buffer.from('data'), filename: 'photo.png', mimeType: 'image/png' },
        ])
      ).rejects.toThrow('Unsupported file type');
    });
  });

  describe('removeDocument', () => {
    it('removes document at index and updates session', async () => {
      vi.mocked(onboardingDb.getSession).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
        contextDocuments: [
          { filename: 'plan.txt', mimeType: 'text/plain', content: 'plan content', uploadedAt: '2026-03-01T00:00:00Z' },
          { filename: 'notes.md', mimeType: 'text/markdown', content: 'notes content', uploadedAt: '2026-03-01T00:00:00Z' },
        ],
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      const result = await service.removeDocument('session-1', 0);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('notes.md');
    });

    it('throws on invalid index', async () => {
      vi.mocked(onboardingDb.getSession).mockResolvedValue({
        id: 'session-1',
        status: 'in_progress',
        conversation: [],
        preceptsDraft: {} as any,
        extractionTracker: { coveredTopics: [], currentPhase: 1, fieldsExtracted: [], fieldsRemaining: [], activeThread: null },
        contextDocuments: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      await expect(service.removeDocument('session-1', 5)).rejects.toThrow('Invalid document index');
    });
  });
});
