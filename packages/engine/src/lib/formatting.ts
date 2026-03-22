import { CORNERSTONE_FIELDS, FIELD_LABELS, type CornerstoneDraft } from '@precept/shared';

export function cornerstoneToMarkdown(content: CornerstoneDraft): string {
  const sections: string[] = [];
  for (const field of CORNERSTONE_FIELDS) {
    const f = content[field];
    if (!f?.content) continue;
    sections.push(`## ${FIELD_LABELS[field]}\n\n${f.content}`);
  }
  return sections.join('\n\n');
}
