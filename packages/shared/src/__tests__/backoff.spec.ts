import { computeBackoffDelayMs, BACKOFF } from '../constants/queue.constants';

describe('computeBackoffDelayMs', () => {
  it('returns a delay of roughly BASE_DELAY_MS for attempt 1 (plus jitter)', () => {
    const delay = computeBackoffDelayMs(1);
    expect(delay).toBeGreaterThanOrEqual(BACKOFF.BASE_DELAY_MS);
    expect(delay).toBeLessThan(BACKOFF.BASE_DELAY_MS + BACKOFF.JITTER_MS);
  });

  it('scales up for each subsequent attempt', () => {
    const delay2Floor = BACKOFF.BASE_DELAY_MS * BACKOFF.MULTIPLIER;
    const delay2 = computeBackoffDelayMs(2);
    expect(delay2).toBeGreaterThanOrEqual(delay2Floor);
  });

  it('caps the delay at MAX_DELAY_MS for very high attempt numbers', () => {
    const delay = computeBackoffDelayMs(20);
    expect(delay).toBeLessThanOrEqual(BACKOFF.MAX_DELAY_MS + BACKOFF.JITTER_MS);
  });

  it('always returns a positive number', () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(computeBackoffDelayMs(attempt)).toBeGreaterThan(0);
    }
  });
});
