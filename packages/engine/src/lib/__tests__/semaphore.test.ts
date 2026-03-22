import { describe, it, expect } from 'vitest';
import { Semaphore } from '../semaphore.js';

describe('Semaphore', () => {
  it('allows up to N concurrent executions', async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let maxRunning = 0;

    const task = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 50));
      running--;
    };

    await Promise.all([sem.run(task), sem.run(task), sem.run(task), sem.run(task)]);

    expect(maxRunning).toBe(2);
  });

  it('returns the value from the function', async () => {
    const sem = new Semaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('releases on error', async () => {
    const sem = new Semaphore(1);

    await expect(sem.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');

    // Should still be able to acquire after error
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });
});
