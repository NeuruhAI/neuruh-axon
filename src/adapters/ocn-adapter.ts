// src/adapters/ocn-adapter.ts
import { AdapterInterface, AdapterRequest, AdapterResponse, ModelInfo } from './adapter-interface';

export interface OCNConfig {
  baseUrl: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

const DEFAULT_CONFIG: OCNConfig = {
  baseUrl: process.env.OCN_BASE_URL || 'http://localhost:8000',
  modelName: process.env.OCN_MODEL || 'Bonsai-8B-mlx',
  maxTokens: 2048,
  temperature: 0.7,
  timeout: 30000,
  retryAttempts: 2,
  healthCheckInterval: 60000,
};

export class OCNAdapter implements AdapterInterface {
  readonly provider = 'ocn';
  private config: OCNConfig;
  private healthy = false;
  private lastHealthCheck = 0;
  private activeLoRA: string | null = null;

  constructor(config: Partial<OCNConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'ocn',
      model: this.config.modelName,
      maxContext: 8192,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      supportsStreaming: true,
      supportsToolCalls: false,
      isLocal: true,
    };
  }

  async isHealthy(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.config.healthCheckInterval) return this.healthy;
    try {
      const res = await fetch(`${this.config.baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      const data = (await res.json()) as { status: string; model: string; tok_per_sec?: number };
      this.healthy = data.status === 'ok';
      this.lastHealthCheck = now;
      return this.healthy;
    } catch {
      this.healthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  async generate(request: AdapterRequest): Promise<AdapterResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const payload = {
          prompt: this.formatPrompt(request),
          max_tokens: request.maxTokens || this.config.maxTokens,
          temperature: request.temperature ?? this.config.temperature,
          stop: request.stopSequences || [],
          lora_adapter: this.activeLoRA,
        };

        const res = await fetch(`${this.config.baseUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) throw new Error(`OCN returned ${res.status}: ${await res.text()}`);

        const data = (await res.json()) as {
          text: string;
          tokens_used: number;
          tok_per_sec: number;
          model: string;
        };

        return {
          content: data.text.trim(),
          model: data.model,
          provider: 'ocn',
          tokensUsed: {
            input: Math.round(data.tokens_used * 0.3),
            output: Math.round(data.tokens_used * 0.7),
          },
          cost: 0,
          latencyMs: Date.now() - startTime,
          metadata: {
            tokPerSec: data.tok_per_sec,
            loraAdapter: this.activeLoRA,
            attempt,
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.retryAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    return {
      content: '',
      model: this.config.modelName,
      provider: 'ocn',
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
      latencyMs: Date.now() - startTime,
      error: lastError?.message || 'OCN generation failed after retries',
    };
  }

  async *stream(request: AdapterRequest): AsyncGenerator<string> {
    const payload = {
      prompt: this.formatPrompt(request),
      max_tokens: request.maxTokens || this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      stream: true,
      lora_adapter: this.activeLoRA,
    };

    const res = await fetch(`${this.config.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeout * 3),
    });

    if (!res.ok || !res.body) throw new Error(`OCN stream failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const token = JSON.parse(line.slice(6)) as { text: string };
          yield token.text;
        }
      }
    }
  }

  async swapLoRA(adapterPath: string | null): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/lora`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapter_path: adapterPath }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`LoRA swap failed: ${res.status}`);
    this.activeLoRA = adapterPath;
  }

  async listLoRAs(): Promise<string[]> {
    const res = await fetch(`${this.config.baseUrl}/lora/list`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { adapters: string[] };
    return data.adapters;
  }

  async classify(text: string, labels: string[]): Promise<{ label: string; confidence: number }> {
    const res = await fetch(`${this.config.baseUrl}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, labels }),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    return (await res.json()) as { label: string; confidence: number };
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.config.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    const data = (await res.json()) as { embedding: number[] };
    return data.embedding;
  }

  private formatPrompt(request: AdapterRequest): string {
    const parts: string[] = [];
    if (request.systemPrompt) parts.push(`<|system|>\n${request.systemPrompt}`);
    if (request.messages) {
      for (const msg of request.messages) parts.push(`<|${msg.role}|>\n${msg.content}`);
    }
    if (request.prompt) parts.push(`<|user|>\n${request.prompt}`);
    parts.push('<|assistant|>');
    return parts.join('\n');
  }
}

export default OCNAdapter;
