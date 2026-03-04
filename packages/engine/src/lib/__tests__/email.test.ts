import { describe, it, expect } from 'vitest';
import type { BriefingContent } from '@precept/shared';
import { briefingToHtml } from '../email.js';

const SAMPLE_CONTENT: BriefingContent = {
  board_requests: [
    {
      number: 1,
      request: 'Approve sensor purchase',
      context: 'PoC requires IMU sensor',
      urgency: 'high',
      fallback: 'Delays hardware testing by 1 week',
    },
  ],
  exceptions: [
    {
      severity: 'warning',
      description: 'Worker flagged import license concern',
      initiative: 'Sensor PoC',
    },
  ],
  results: {
    north_star: 'Sensor basketball PoC',
    initiatives: [
      {
        name: 'Sensor PoC',
        status: 'Phase 1: Hardware Setup — 35% complete',
        outcome_summary: 'Pin diagram complete, data capture app in progress',
      },
    ],
  },
  forward_look: 'Complete data capture app, begin calibration testing.',
};

describe('briefingToHtml', () => {
  it('generates HTML with all sections', () => {
    const html = briefingToHtml(SAMPLE_CONTENT);

    expect(html).toContain('Board Requests');
    expect(html).toContain('Approve sensor purchase');
    expect(html).toContain('Exceptions');
    expect(html).toContain('import license concern');
    expect(html).toContain('Results');
    expect(html).toContain('Sensor PoC');
    expect(html).toContain('Forward Look');
    expect(html).toContain('calibration testing');
  });

  it('handles empty board requests', () => {
    const html = briefingToHtml({
      ...SAMPLE_CONTENT,
      board_requests: [],
    });

    expect(html).not.toContain('Board Requests');
    expect(html).toContain('Results');
  });

  it('handles empty exceptions', () => {
    const html = briefingToHtml({
      ...SAMPLE_CONTENT,
      exceptions: [],
    });

    expect(html).not.toContain('Exceptions');
  });
});
