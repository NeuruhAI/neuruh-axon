// src/core/coordinator.ts
// AXON Coordinator (MOTHER v2) — task decomposition + parallel worker orchestration.
// Spec: AXON-COORD-004. Absorbs MOTHER v1 (Signal Sniffer) + SAL pipeline.

export interface Task {
  id: string;
  objective: string;
  context?: Record<string, unknown>;
  maxWorkers?: number;
  budgetUsd?: number;
}

export interface WorkerResult {
  workerId: string;
  subtaskId: string;
  output: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  error?: string;
}

export interface Subtask {
  id: string;
  description: string;
  dependencies?: string[];
}

export interface CoordinatorResult {
  taskId: string;
  output: string;
  workerResults: WorkerResult[];
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

export interface Scratchpad {
  read(): Promise<string>;
  append(entry: string): Promise<void>;
  clear(): Promise<void>;
}

export interface TaskDecomposer {
  decompose(task: Task): Promise<Subtask[]>;
}

export interface ResultSynthesizer {
  synthesize(task: Task, results: WorkerResult[]): Promise<string>;
}

export interface Worker {
  readonly id: string;
  execute(subtask: Subtask, scratchpad: Scratchpad): Promise<WorkerResult>;
}

export interface Coordinator {
  run(task: Task): Promise<CoordinatorResult>;
  workerCount(): number;
}

export class InMemoryScratchpad implements Scratchpad {
  private entries: string[] = [];
  async read(): Promise<string> {
    return this.entries.join('\n');
  }
  async append(entry: string): Promise<void> {
    this.entries.push(entry);
  }
  async clear(): Promise<void> {
    this.entries = [];
  }
}
