/**
 * Centralized DB error handling. All DB modules should use these helpers
 * instead of inline error checking.
 *
 * Intentional exceptions (not migrated):
 * - audit.ts logEvent: fire-and-forget, silently swallows errors
 * - messages.ts logMessage: fire-and-forget, silently swallows errors
 */

export class DatabaseError extends Error {
  constructor(
    public readonly label: string,
    public readonly cause: unknown,
  ) {
    const msg = cause instanceof Error
      ? cause.message
      : typeof cause === 'object' && cause !== null && 'message' in cause
        ? (cause as { message: string }).message
        : String(cause);
    super(`DB error [${label}]: ${msg}`);
    this.name = 'DatabaseError';
  }
}

/**
 * Execute a DB query that MUST return data. Throws on error or null data.
 * Use for: inserts returning data, required lookups.
 */
export async function dbQuery<T>(
  label: string,
  queryFn: () => Promise<{ data: T | null; error: any }>,
): Promise<T> {
  const { data, error } = await queryFn();
  if (error) throw new DatabaseError(label, error);
  if (data === null) throw new DatabaseError(label, 'No data returned');
  return data;
}

/**
 * Execute a DB query that may return null (not-found is valid).
 * PGRST116 ("no rows") returns null instead of throwing.
 * Use for: single-row lookups by ID.
 */
export async function dbQueryOptional<T>(
  label: string,
  queryFn: () => Promise<{ data: T | null; error: any }>,
): Promise<T | null> {
  const { data, error } = await queryFn();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new DatabaseError(label, error);
  }
  return data;
}
