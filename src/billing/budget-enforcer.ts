// src/billing/budget-enforcer.ts
// AXON Budget Enforcer — hard caps, soft caps, alerting. Spec: AXON-BE-008.

import { CostTracker } from './cost-tracker';

export interface BudgetPolicy {
  tenantId: string;
  periodStart: number;
  periodEnd: number;
  softCapUsd: number;
  hardCapUsd: number;
  alertWebhook?: string;
}

export type BudgetDecision =
  | { allow: true; remainingUsd: number }
  | { allow: false; reason: 'hard-cap-exceeded'; spentUsd: number; hardCapUsd: number };

export interface BudgetEnforcer {
  checkBeforeRequest(tenantId: string, estimatedCostUsd: number): Promise<BudgetDecision>;
  setPolicy(policy: BudgetPolicy): Promise<void>;
  getPolicy(tenantId: string): Promise<BudgetPolicy | null>;
}

export class SimpleBudgetEnforcer implements BudgetEnforcer {
  private policies = new Map<string, BudgetPolicy>();
  constructor(private readonly tracker: CostTracker) {}

  async checkBeforeRequest(tenantId: string, estimatedCostUsd: number): Promise<BudgetDecision> {
    const policy = this.policies.get(tenantId);
    if (!policy) return { allow: true, remainingUsd: Number.POSITIVE_INFINITY };
    const spend = await this.tracker.tenantSpend(tenantId, policy.periodStart, policy.periodEnd);
    const remaining = policy.hardCapUsd - spend.totalUsd;
    if (spend.totalUsd + estimatedCostUsd > policy.hardCapUsd) {
      return { allow: false, reason: 'hard-cap-exceeded', spentUsd: spend.totalUsd, hardCapUsd: policy.hardCapUsd };
    }
    return { allow: true, remainingUsd: remaining };
  }

  async setPolicy(policy: BudgetPolicy): Promise<void> {
    this.policies.set(policy.tenantId, policy);
  }

  async getPolicy(tenantId: string): Promise<BudgetPolicy | null> {
    return this.policies.get(tenantId) ?? null;
  }
}
