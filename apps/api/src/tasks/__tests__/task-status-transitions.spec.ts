import { TaskStatus, canTransition, TASK_STATUS_TRANSITIONS } from '@distrotask/shared';

describe('Task status state machine', () => {
  it('allows PENDING -> QUEUED', () => {
    expect(canTransition(TaskStatus.PENDING, TaskStatus.QUEUED)).toBe(true);
  });

  it('allows PENDING -> CANCELLED', () => {
    expect(canTransition(TaskStatus.PENDING, TaskStatus.CANCELLED)).toBe(true);
  });

  it('rejects PENDING -> COMPLETED (cannot skip QUEUED/RUNNING)', () => {
    expect(canTransition(TaskStatus.PENDING, TaskStatus.COMPLETED)).toBe(false);
  });

  it('allows RUNNING -> COMPLETED, FAILED, RETRYING, CANCELLED', () => {
    expect(canTransition(TaskStatus.RUNNING, TaskStatus.COMPLETED)).toBe(true);
    expect(canTransition(TaskStatus.RUNNING, TaskStatus.FAILED)).toBe(true);
    expect(canTransition(TaskStatus.RUNNING, TaskStatus.RETRYING)).toBe(true);
    expect(canTransition(TaskStatus.RUNNING, TaskStatus.CANCELLED)).toBe(true);
  });

  it('rejects RUNNING -> PENDING (no going backwards)', () => {
    expect(canTransition(TaskStatus.RUNNING, TaskStatus.PENDING)).toBe(false);
  });

  it('rejects any transition out of COMPLETED (terminal state)', () => {
    const allTargets = Object.values(TaskStatus);
    for (const target of allTargets) {
      expect(canTransition(TaskStatus.COMPLETED, target)).toBe(false);
    }
  });

  it('rejects any transition out of CANCELLED (terminal state)', () => {
    const allTargets = Object.values(TaskStatus);
    for (const target of allTargets) {
      expect(canTransition(TaskStatus.CANCELLED, target)).toBe(false);
    }
  });

  it('allows FAILED -> QUEUED (manual retry)', () => {
    expect(canTransition(TaskStatus.FAILED, TaskStatus.QUEUED)).toBe(true);
  });

  it('allows DEAD_LETTERED -> QUEUED (manual replay from DLQ)', () => {
    expect(canTransition(TaskStatus.DEAD_LETTERED, TaskStatus.QUEUED)).toBe(true);
  });

  it('allows RETRYING -> QUEUED (automatic retry redelivery)', () => {
    expect(canTransition(TaskStatus.RETRYING, TaskStatus.QUEUED)).toBe(true);
  });

  it('defines a transition list for every TaskStatus value', () => {
    const allStatuses = Object.values(TaskStatus);
    for (const status of allStatuses) {
      expect(TASK_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('returns false for an undefined/unknown source status rather than throwing', () => {
    expect(canTransition('NOT_A_REAL_STATUS' as TaskStatus, TaskStatus.QUEUED)).toBe(false);
  });
});
