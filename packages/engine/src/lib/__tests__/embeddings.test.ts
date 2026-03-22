import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPipeline } = vi.hoisted(() => ({
  mockPipeline: vi.fn(),
}));

vi.mock('@huggingface/transformers', () => ({
  pipeline: mockPipeline,
}));

import { embedText, embedTexts, _resetEmbedder } from '../embeddings.js';

describe('embeddings', () => {
  const fakeVector = new Float32Array(768).fill(0.1);

  beforeEach(() => {
    vi.clearAllMocks();
    _resetEmbedder();
    const mockModel = vi.fn().mockResolvedValue({ data: fakeVector });
    mockPipeline.mockResolvedValue(mockModel);
  });

  it('embedText with query uses correct prompt prefix', async () => {
    const result = await embedText('basketball stats', 'query');

    expect(result).toHaveLength(768);
    expect(result[0]).toBeCloseTo(0.1);

    expect(mockPipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'onnx-community/embeddinggemma-300m-ONNX',
    );

    const mockModel = await mockPipeline.mock.results[0].value;
    expect(mockModel).toHaveBeenCalledWith(
      'task: search result | query: basketball stats',
      { pooling: 'mean', normalize: true },
    );
  });

  it('embedText with document uses correct prompt prefix', async () => {
    const result = await embedText('player scored 30 points', 'document');

    expect(result).toHaveLength(768);

    const mockModel = await mockPipeline.mock.results[0].value;
    expect(mockModel).toHaveBeenCalledWith(
      'title: none | text: player scored 30 points',
      { pooling: 'mean', normalize: true },
    );
  });

  it('embedTexts returns array of correct length', async () => {
    const batchVector = new Float32Array(768 * 3).fill(0.2);
    const mockModel = vi.fn().mockResolvedValue({ data: batchVector });
    mockPipeline.mockResolvedValue(mockModel);

    const results = await embedTexts(
      ['text one', 'text two', 'text three'],
      'document',
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveLength(768);
    expect(results[1]).toHaveLength(768);
    expect(results[2]).toHaveLength(768);
  });

  it('singleton: reuses pipeline across calls', async () => {
    await embedText('first call', 'query');
    await embedText('second call', 'query');

    // pipeline() called only once despite two embedText calls
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });
});
