import { describe, it, expect } from 'vitest';
import { extractText, ALLOWED_MIME_TYPES } from '../documents';

describe('extractText', () => {
  it('extracts plain text from a buffer', async () => {
    const buffer = Buffer.from('Hello, world!');
    const result = await extractText(buffer, 'text/plain');
    expect(result).toBe('Hello, world!');
  });

  it('extracts markdown as-is', async () => {
    const buffer = Buffer.from('# Heading\n\nSome **bold** text.');
    const result = await extractText(buffer, 'text/markdown');
    expect(result).toBe('# Heading\n\nSome **bold** text.');
  });

  it('throws on unsupported MIME type', async () => {
    const buffer = Buffer.from('data');
    await expect(extractText(buffer, 'image/png')).rejects.toThrow('Unsupported file type');
  });

  it('extracts text from a PDF buffer', async () => {
    // pdf-parse requires a real PDF buffer. Create a minimal one.
    const minimalPdf = Buffer.from(
      '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF'
    );
    const result = await extractText(minimalPdf, 'application/pdf');
    expect(typeof result).toBe('string');
  });
});
