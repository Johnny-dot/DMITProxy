export type BillingDayAction = 'applied' | 'noop' | 'mismatch';

export interface BillingDayDecisionInput {
  nextResetDay: number | null;
  autoAppliedBillingDay: number | null;
  /** billing_day for every inbound that has one configured (empty array if none). */
  currentBillingDays: number[];
}

export interface BillingDayDecision {
  action: BillingDayAction;
  /** Day to apply when action === 'applied'; null otherwise. */
  applyTo: number | null;
}

export function decideBillingDayAction(input: BillingDayDecisionInput): BillingDayDecision {
  const { nextResetDay, autoAppliedBillingDay, currentBillingDays } = input;
  if (nextResetDay == null) return { action: 'noop', applyTo: null };

  if (autoAppliedBillingDay == null) {
    // First sync: apply DMIT's day to inbounds that have no billing_day yet.
    return { action: 'applied', applyTo: nextResetDay };
  }

  // Already auto-applied previously.
  if (autoAppliedBillingDay !== nextResetDay) {
    return { action: 'mismatch', applyTo: null };
  }
  if (currentBillingDays.some((day) => day !== nextResetDay)) {
    return { action: 'mismatch', applyTo: null };
  }
  return { action: 'noop', applyTo: null };
}
