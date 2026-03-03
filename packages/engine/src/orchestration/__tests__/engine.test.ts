import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestrationEngine } from '../engine.js';
import type { EngineEvent } from '../engine.js';

describe('OrchestrationEngine', () => {
  let engine: OrchestrationEngine;
  let handledEvents: EngineEvent[];

  beforeEach(() => {
    handledEvents = [];
    engine = new OrchestrationEngine();
    // Spy on handleEvent to track processing
    vi.spyOn(engine, 'handleEvent').mockImplementation(async (event) => {
      handledEvents.push(event);
    });
  });

  it('processes pushed events', async () => {
    engine.push({ type: 'planning_cycle', orgId: 'org-1' });

    // Wait for async processing
    await vi.waitFor(() => {
      expect(handledEvents).toHaveLength(1);
    });

    expect(handledEvents[0]).toEqual({ type: 'planning_cycle', orgId: 'org-1' });
  });

  it('processes events sequentially', async () => {
    const order: number[] = [];
    vi.spyOn(engine, 'handleEvent').mockImplementation(async (event) => {
      const idx = event.type === 'planning_cycle' ? 1 : 2;
      order.push(idx);
      await new Promise((r) => setTimeout(r, 10));
      order.push(idx * 10);
    });

    engine.push({ type: 'planning_cycle', orgId: 'org-1' });
    engine.push({ type: 'briefing_cycle', orgId: 'org-1' });

    await vi.waitFor(() => {
      expect(order).toHaveLength(4);
    });

    // First event completes before second starts
    expect(order).toEqual([1, 10, 2, 20]);
  });

  it('does not drop events pushed during processing', async () => {
    let callCount = 0;
    vi.spyOn(engine, 'handleEvent').mockImplementation(async (event) => {
      callCount++;
      if (callCount === 1) {
        // Push a second event during the first event's processing
        engine.push({ type: 'briefing_cycle', orgId: 'org-1' });
        await new Promise((r) => setTimeout(r, 10));
      }
    });

    engine.push({ type: 'planning_cycle', orgId: 'org-1' });

    await vi.waitFor(() => {
      expect(callCount).toBe(2);
    });
  });
});
