import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pipeline as any;
    embedder = (await p(
      'feature-extraction',
      'onnx-community/embeddinggemma-300m-ONNX',
    )) as FeatureExtractionPipeline;
  }
  return embedder;
}

/** Reset the singleton — for tests only. */
export function _resetEmbedder(): void {
  embedder = null;
}

/**
 * Embed a single text string into a 768-dim vector.
 *
 * EmbeddingGemma uses task-specific prompts:
 * - 'query': for search queries against role memory
 * - 'document': for entries being stored in role memory
 */
export async function embedText(
  input: string,
  promptType: 'query' | 'document' = 'query',
): Promise<number[]> {
  const model = await getEmbedder();

  const prompted =
    promptType === 'query'
      ? `task: search result | query: ${input}`
      : `title: none | text: ${input}`;

  const result = await model(prompted, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data as Float32Array).slice(0, 768);
}

/**
 * Embed multiple texts in a batch (more efficient than one-by-one).
 */
export async function embedTexts(
  inputs: string[],
  promptType: 'query' | 'document' = 'query',
): Promise<number[][]> {
  const model = await getEmbedder();

  const prompted = inputs.map((input) =>
    promptType === 'query'
      ? `task: search result | query: ${input}`
      : `title: none | text: ${input}`,
  );

  const result = await model(prompted, {
    pooling: 'mean',
    normalize: true,
  });

  const flat = Array.from(result.data as Float32Array);
  const vectors: number[][] = [];
  for (let i = 0; i < inputs.length; i++) {
    vectors.push(flat.slice(i * 768, (i + 1) * 768));
  }
  return vectors;
}
