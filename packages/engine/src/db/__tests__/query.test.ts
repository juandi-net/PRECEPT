import { describe, it, expect } from 'vitest';
import { dbQuery, dbQueryOptional, DatabaseError } from '../query.js';

describe('dbQuery', () => {
  it('returns data on success', async () => {
    const result = await dbQuery('test', async () => ({ data: { id: 1 }, error: null }));
    expect(result).toEqual({ id: 1 });
  });

  it('throws DatabaseError on error', async () => {
    await expect(
      dbQuery('test-op', async () => ({ data: null, error: { message: 'connection failed' } }))
    ).rejects.toThrow(DatabaseError);
  });

  it('throws DatabaseError when data is null', async () => {
    await expect(
      dbQuery('test-op', async () => ({ data: null, error: null }))
    ).rejects.toThrow(DatabaseError);
  });

  it('includes label in error message', async () => {
    await expect(
      dbQuery('getUser', async () => ({ data: null, error: { message: 'timeout' } }))
    ).rejects.toThrow(/getUser/);
  });
});

describe('dbQueryOptional', () => {
  it('returns data on success', async () => {
    const result = await dbQueryOptional('test', async () => ({ data: { id: 1 }, error: null }));
    expect(result).toEqual({ id: 1 });
  });

  it('returns null on PGRST116 (no rows)', async () => {
    const result = await dbQueryOptional('test', async () => ({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    }));
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 errors', async () => {
    await expect(
      dbQueryOptional('test', async () => ({
        data: null,
        error: { code: '23505', message: 'unique violation' },
      }))
    ).rejects.toThrow(DatabaseError);
  });

  it('returns null when data is null and no error', async () => {
    const result = await dbQueryOptional('test', async () => ({ data: null, error: null }));
    expect(result).toBeNull();
  });
});
