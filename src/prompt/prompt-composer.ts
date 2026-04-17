// src/prompt/prompt-composer.ts
// AXON Prompt Composer — OMNIA-6 modular prompt assembly with cache boundaries.
// Spec: AXON-PC-006.

export type OmniaLayer =
  | 'L1-identity'
  | 'L2-goal'
  | 'L3-reasoning'
  | 'L4-reflection'
  | 'L5-tools'
  | 'L6-memory';

export interface PromptSection {
  layer: OmniaLayer;
  content: string;
  cacheable: boolean;
  tokenEstimate: number;
}

export interface ComposedPrompt {
  systemPrompt: string;
  sections: PromptSection[];
  totalTokens: number;
  cacheableTokens: number;
  dynamicTokens: number;
}

export interface SectionCache {
  get(key: string): Promise<PromptSection | null>;
  set(key: string, section: PromptSection): Promise<void>;
  invalidate(key: string): Promise<void>;
}

export interface RoleSwapper {
  swap(agentId: string, role: string): Promise<PromptSection>;
  listRoles(agentId: string): Promise<string[]>;
}

export interface PromptComposer {
  compose(agentId: string, task: string, roleOverride?: string): Promise<ComposedPrompt>;
  tokenBreakdown(composed: ComposedPrompt): Record<OmniaLayer, number>;
}
