// src/billing/cost-tracker.ts
// AXON Cost Tracker — per-request, per-tenant cost accounting.
// Spec: AXON-CT-007.

export interface CostEvent {
  tenantId: string;
  agentId: string;
  requestId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

export interface TenantSpend {
  tenantId: string;
  periodStart: number;
  periodEnd: number;
  totalUsd: number;
  byProvider: Record<string, number>;
  byAgent: Record<string, number>;
}

export interface CostTracker {
  record(event: CostEvent): Promise<void>;
  tenantSpend(tenantId: string, periodStart: number, periodEnd: number): Promise<TenantSpend>;
  recentEvents(tenantId: string, limit: number): Promise<CostEvent[]>;
}
