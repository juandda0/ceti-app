/**
 * Assignment lifecycle status, derived purely from dates + completion. Used by
 * both the teacher list and the student view. No time-based gamification — this
 * is plain deadline tracking.
 */
export type AssignmentStatus = 'upcoming' | 'active' | 'overdue' | 'done';

export function assignmentStatus(
  a: { fechaInicio: number; deadline: number },
  now: number,
  completed: boolean
): AssignmentStatus {
  if (completed) return 'done';
  if (now < a.fechaInicio) return 'upcoming';
  if (now > a.deadline) return 'overdue';
  return 'active';
}

/** Whole days remaining until the deadline (negative if overdue). */
export function daysUntil(deadline: number, now: number): number {
  return Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
}
