import { computeRate, isTerminalStatus, omitUndefined, TaskStatus } from '@distrotask/shared';

describe('computeRate', () => {
  it('returns 0 when denominator is 0 (no divide-by-zero crash)', () => {
    expect(computeRate(5, 0)).toBe(0);
  });

  it('computes a correct percentage rounded to 2 decimal places', () => {
    expect(computeRate(1, 3)).toBe(33.33);
  });

  it('returns 100 for a perfect ratio', () => {
    expect(computeRate(10, 10)).toBe(100);
  });
});

describe('isTerminalStatus', () => {
  it('treats COMPLETED, FAILED, CANCELLED, DEAD_LETTERED as terminal', () => {
    expect(isTerminalStatus(TaskStatus.COMPLETED)).toBe(true);
    expect(isTerminalStatus(TaskStatus.FAILED)).toBe(true);
    expect(isTerminalStatus(TaskStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(TaskStatus.DEAD_LETTERED)).toBe(true);
  });

  it('treats PENDING, QUEUED, RUNNING, RETRYING as non-terminal', () => {
    expect(isTerminalStatus(TaskStatus.PENDING)).toBe(false);
    expect(isTerminalStatus(TaskStatus.QUEUED)).toBe(false);
    expect(isTerminalStatus(TaskStatus.RUNNING)).toBe(false);
    expect(isTerminalStatus(TaskStatus.RETRYING)).toBe(false);
  });
});

describe('omitUndefined', () => {
  it('removes keys with undefined values but keeps null/false/0', () => {
    const result = omitUndefined({ a: undefined, b: null, c: 0, d: false, e: 'value' });
    expect(result).toEqual({ b: null, c: 0, d: false, e: 'value' });
  });

  it('returns an empty object when all values are undefined', () => {
    expect(omitUndefined({ a: undefined, b: undefined })).toEqual({});
  });
});
