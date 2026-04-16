// src/adapters/adapter-interface.ts
export interface ModelInfo {
  provider: string;
  model: string;
  maxContext: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  isLocal: boolean;
}

export interface AdapterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AdapterRequest {
  prompt?: string;
  systemPrompt?: string;
  messages?: AdapterMessage[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  tools?: unknown[];
}

export interface AdapterResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: { input: number; output: number };
  cost: number;
  latencyMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterInterface {
  readonly provider: string;
  getModelInfo(): ModelInfo;
  isHealthy(): Promise<boolean>;
  generate(request: AdapterRequest): Promise<AdapterResponse>;
  stream?(request: AdapterRequest): AsyncGenerator<string>;
}
