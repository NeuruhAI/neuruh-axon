// src/core/model-router.ts
import { AdapterInterface, AdapterRequest, AdapterResponse } from '../adapters/adapter-interface';

export type RoutingStrategy = 'cost' | 'speed' | 'quality' | 'local-first' | 'fallback-chain';

export interface RoutingRule {
  taskType?: string;
  maxCostPer1k?: number;
  preferLocal?: boolean;
  requiredCapabilities?: ('streaming' | 'tool-calls')[];
  provider?: string;
}

export interface RouteResult {
  adapter: AdapterInterface;
  reason: string;
}

export interface RouterConfig {
  defaultStrategy: RoutingStrategy;
  fallbackOrder: string[];
  costBudgetPer1k?: number;
  rules: RoutingRule[];
}

const DEFAULT_CONFIG: RouterConfig = {
  defaultStrategy: 'fallback-chain',
  fallbackOrder: ['ocn', 'groq', 'claude', 'openai'],
  rules: [],
};

export class ModelRouter {
  private adapters = new Map<string, AdapterInterface>();
  private config: RouterConfig;
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerAdapter(adapter: AdapterInterface): void {
    this.adapters.set(adapter.provider, adapter);
    this.requestCounts.set(adapter.provider, 0);
    this.errorCounts.set(adapter.provider, 0);
  }

  removeAdapter(provider: string): void {
    this.adapters.delete(provider);
  }

  async selectAdapter(request: AdapterRequest, rule?: RoutingRule): Promise<RouteResult> {
    const strategy = this.config.defaultStrategy;

    if (rule?.provider && this.adapters.has(rule.provider)) {
      const adapter = this.adapters.get(rule.provider)!;
      if (await adapter.isHealthy()) {
        return { adapter, reason: `rule: forced provider ${rule.provider}` };
      }
    }

    const candidates = await this.getHealthyCandidates(rule);
    if (candidates.length === 0) throw new Error('No healthy adapters available');

    switch (strategy) {
      case 'cost':
        return this.routeByCost(candidates);
      case 'speed':
        return this.routeBySpeed(candidates);
      case 'quality':
        return this.routeByQuality(candidates);
      case 'local-first':
        return this.routeLocalFirst(candidates);
      case 'fallback-chain':
      default:
        return this.routeByFallbackChain(candidates);
    }
  }

  async route(request: AdapterRequest, rule?: RoutingRule): Promise<AdapterResponse> {
    const candidates = await this.getHealthyCandidates(rule);
    const ordered = this.orderByFallback(candidates);

    for (const adapter of ordered) {
      try {
        this.requestCounts.set(adapter.provider, (this.requestCounts.get(adapter.provider) || 0) + 1);
        const response = await adapter.generate(request);
        if (!response.error) return response;
      } catch {
        this.errorCounts.set(adapter.provider, (this.errorCounts.get(adapter.provider) || 0) + 1);
        continue;
      }
    }
    throw new Error('All adapters failed for request');
  }

  private routeByCost(candidates: AdapterInterface[]): RouteResult {
    const sorted = [...candidates].sort((a, b) => {
      const aInfo = a.getModelInfo();
      const bInfo = b.getModelInfo();
      return (
        aInfo.costPer1kInput + aInfo.costPer1kOutput - (bInfo.costPer1kInput + bInfo.costPer1kOutput)
      );
    });
    return { adapter: sorted[0], reason: 'strategy: lowest cost' };
  }

  private routeBySpeed(candidates: AdapterInterface[]): RouteResult {
    const local = candidates.find((a) => a.getModelInfo().isLocal);
    if (local) return { adapter: local, reason: 'strategy: speed (local)' };
    const groq = candidates.find((a) => a.provider === 'groq');
    if (groq) return { adapter: groq, reason: 'strategy: speed (groq)' };
    return { adapter: candidates[0], reason: 'strategy: speed (first available)' };
  }

  private routeByQuality(candidates: AdapterInterface[]): RouteResult {
    const qualityOrder = ['claude', 'openai', 'groq', 'ocn'];
    for (const provider of qualityOrder) {
      const match = candidates.find((a) => a.provider === provider);
      if (match) return { adapter: match, reason: `strategy: quality (${provider})` };
    }
    return { adapter: candidates[0], reason: 'strategy: quality (fallback)' };
  }

  private routeLocalFirst(candidates: AdapterInterface[]): RouteResult {
    const local = candidates.find((a) => a.getModelInfo().isLocal);
    if (local) return { adapter: local, reason: 'strategy: local-first' };
    return this.routeByFallbackChain(candidates);
  }

  private routeByFallbackChain(candidates: AdapterInterface[]): RouteResult {
    const ordered = this.orderByFallback(candidates);
    return { adapter: ordered[0], reason: `strategy: fallback-chain (${ordered[0].provider})` };
  }

  private async getHealthyCandidates(rule?: RoutingRule): Promise<AdapterInterface[]> {
    const all = Array.from(this.adapters.values());
    const healthy: AdapterInterface[] = [];

    for (const adapter of all) {
      if (!(await adapter.isHealthy())) continue;
      const info = adapter.getModelInfo();

      if (rule?.requiredCapabilities) {
        if (rule.requiredCapabilities.includes('streaming') && !info.supportsStreaming) continue;
        if (rule.requiredCapabilities.includes('tool-calls') && !info.supportsToolCalls) continue;
      }
      if (rule?.maxCostPer1k !== undefined) {
        if (info.costPer1kInput + info.costPer1kOutput > rule.maxCostPer1k) continue;
      }
      if (rule?.preferLocal && !info.isLocal) continue;

      healthy.push(adapter);
    }
    return healthy;
  }

  private orderByFallback(candidates: AdapterInterface[]): AdapterInterface[] {
    return [...candidates].sort((a, b) => {
      const aIdx = this.config.fallbackOrder.indexOf(a.provider);
      const bIdx = this.config.fallbackOrder.indexOf(b.provider);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }

  getStats(): Record<string, { requests: number; errors: number; errorRate: number }> {
    const stats: Record<string, { requests: number; errors: number; errorRate: number }> = {};
    for (const [provider] of this.adapters) {
      const reqs = this.requestCounts.get(provider) || 0;
      const errs = this.errorCounts.get(provider) || 0;
      stats[provider] = { requests: reqs, errors: errs, errorRate: reqs > 0 ? errs / reqs : 0 };
    }
    return stats;
  }
}

export default ModelRouter;
