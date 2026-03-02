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
