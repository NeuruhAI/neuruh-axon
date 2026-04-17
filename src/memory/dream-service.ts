// src/memory/dream-service.ts
// AXON Dream Service — PMLA-based persistent memory consolidation.
// Spec: AXON-DREAM-005.

export type PmlaBlockKind = 'identity' | 'context' | 'history' | 'rules' | 'handoff';

export interface PmlaBlock {
  kind: PmlaBlockKind;
  content: string;
  tokenEstimate: number;
  lastConsolidated: number;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  messagesCount: number;
  decisions: string[];
  openQuestions: string[];
}

export interface EtaReport {
  originalTokens: number;
  consolidatedTokens: number;
  compressionRatio: number;
  meetsThreshold: boolean;
}

export interface DreamGate {
  minElapsedMs: number;
  minSessionCount: number;
  isLocked(): Promise<boolean>;
  acquireLock(): Promise<boolean>;
  releaseLock(): Promise<void>;
}

export interface MemoryStore {
  getBlocks(agentId: string): Promise<PmlaBlock[]>;
  upsertBlock(agentId: string, block: PmlaBlock): Promise<void>;
  listSessions(agentId: string, sinceMs: number): Promise<SessionSummary[]>;
}

export interface ConsolidationPrompt {
  build(blocks: PmlaBlock[], sessions: SessionSummary[]): string;
}

export interface ContextInjector {
  inject(agentId: string, systemPrompt: string): Promise<string>;
}

export interface DreamService {
  maybeRun(agentId: string): Promise<EtaReport | null>;
  forceRun(agentId: string): Promise<EtaReport>;
}
