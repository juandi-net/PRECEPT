import { describe, it, expect } from 'vitest';
import { letterToHtml } from '../email.js';

describe('letterToHtml', () => {
  it('wraps letter in styled HTML', () => {
    const html = letterToHtml('Hello, this is your CEO.', 'Acme Corp');

    expect(html).toContain('Acme Corp');
    expect(html).toContain('Hello, this is your CEO.');
    expect(html).toContain("font-family: 'Times New Roman'");
  });

  it('converts markdown links to <a> tags', () => {
    const html = letterToHtml(
      'The report is ready ([view](/inspect/task/abc123)).',
      'Acme Corp'
    );

    expect(html).toContain('<a href="/inspect/task/abc123"');
    expect(html).toContain('>view</a>');
  });

  it('handles multiple links', () => {
    const html = letterToHtml(
      'See [report](/inspect/task/1) and [plan](/inspect/initiative/2).',
      'Test Org'
    );

    expect(html).toContain('<a href="/inspect/task/1"');
    expect(html).toContain('<a href="/inspect/initiative/2"');
  });

  it('handles letter with no links', () => {
    const html = letterToHtml('Everything is running smoothly.', 'Test Org');

    expect(html).not.toContain('<a ');
    expect(html).toContain('Everything is running smoothly.');
  });
});
