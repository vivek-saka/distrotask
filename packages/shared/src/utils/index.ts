import { TaskStatus } from '../types/enums';

/** Computes success/failure rate as a percentage, safe against divide-by-zero. */
export function computeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.DEAD_LETTERED].includes(
    status,
  );
}

/** Strips undefined keys so partial update objects don't overwrite fields with `undefined`. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
