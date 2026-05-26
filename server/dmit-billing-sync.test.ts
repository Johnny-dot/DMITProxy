import { describe, expect, it } from 'vitest';
import { decideBillingDayAction } from './dmit-billing-sync.js';

describe('decideBillingDayAction', () => {
  it('returns noop when nextResetDay is missing', () => {
    const result = decideBillingDayAction({
      nextResetDay: null,
      autoAppliedBillingDay: null,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'noop', applyTo: null });
  });

  it('returns applied + day to mark when first sync and no inbound has billing_day', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: null,
      currentBillingDays: [], // no inbound has billing day configured
    });
    expect(result).toEqual({ action: 'applied', applyTo: 3 });
  });

  it("returns applied when first sync and only some inbounds have billing_day (apply to the ones that don't)", () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: null,
      currentBillingDays: [5], // one inbound already has day=5, others unset
    });
    expect(result).toEqual({ action: 'applied', applyTo: 3 });
  });

  it('returns mismatch when auto-applied previously but DMIT changed its reset day', () => {
    const result = decideBillingDayAction({
      nextResetDay: 5,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'mismatch', applyTo: null });
  });

  it('returns mismatch when auto-applied previously and inbound billing days drift', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 5], // user manually changed one
    });
    expect(result).toEqual({ action: 'mismatch', applyTo: null });
  });

  it('returns noop when previously applied and everything still matches', () => {
    const result = decideBillingDayAction({
      nextResetDay: 3,
      autoAppliedBillingDay: 3,
      currentBillingDays: [3, 3],
    });
    expect(result).toEqual({ action: 'noop', applyTo: null });
  });
});
