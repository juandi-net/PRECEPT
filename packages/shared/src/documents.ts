export interface ContextDocument {
  filename: string;
  mimeType: string;
  content: string;
  uploadedAt: string;
}

export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

import { PDFParse } from 'pdf-parse';

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    }
    case 'text/plain':
    case 'text/markdown':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
