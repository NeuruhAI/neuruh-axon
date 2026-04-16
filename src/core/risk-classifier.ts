// src/core/risk-classifier.ts

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ApprovalMode = 'auto' | 'interactive' | 'deny-all' | 'bypass';

export interface RiskRule {
  pattern: RegExp | string;
  level: RiskLevel;
  reason: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  reasons: string[];
  requiresApproval: boolean;
  autoApproved: boolean;
  timestamp: number;
}

export interface ClassifierConfig {
  mode: ApprovalMode;
  autoApproveThreshold: number;
  customRules: RiskRule[];
  protectedPaths: string[];
  destructiveCommands: string[];
}

const DEFAULT_CONFIG: ClassifierConfig = {
  mode: 'interactive',
  autoApproveThreshold: 30,
  customRules: [],
  protectedPaths: [
    '/etc', '/usr', '/System', '/var', '/boot',
    '~/.ssh', '~/.gnupg', '~/.aws', '~/.config',
    '/Volumes/NEURUH-HD',
  ],
  destructiveCommands: [
    'rm -rf', 'mkfs', 'dd if=', 'chmod -R 777',
    'DROP TABLE', 'DELETE FROM', 'TRUNCATE',
    'docker system prune', 'kubectl delete',
    'firebase deploy', 'npm publish',
    'git push --force', 'git reset --hard',
  ],
};

export class RiskClassifier {
  private config: ClassifierConfig;
  private auditLog: RiskAssessment[] = [];

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  classify(toolName: string, args: Record<string, unknown>): RiskAssessment {
    const reasons: string[] = [];
    let score = 0;

    const toolRisk = this.classifyToolType(toolName);
    score += toolRisk.score;
    reasons.push(...toolRisk.reasons);

    const argStr = JSON.stringify(args).toLowerCase();

    for (const cmd of this.config.destructiveCommands) {
      if (argStr.includes(cmd.toLowerCase())) {
        score += 40;
        reasons.push(`Destructive command detected: ${cmd}`);
      }
    }

    for (const path of this.config.protectedPaths) {
      if (argStr.includes(path.toLowerCase())) {
        score += 30;
        reasons.push(`Protected path accessed: ${path}`);
      }
    }

    if (argStr.includes('curl') || argStr.includes('wget') || argStr.includes('fetch(')) {
      score += 15;
      reasons.push('Network operation detected');
    }

    if (argStr.includes('process.env') || argStr.includes('.env') || argStr.includes('secret')) {
      score += 25;
      reasons.push('Environment/secret access detected');
    }

    for (const rule of this.config.customRules) {
      const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
      if (pattern.test(argStr)) {
        score += rule.level === 'HIGH' ? 50 : rule.level === 'MEDIUM' ? 25 : 10;
        reasons.push(rule.reason);
      }
    }

    const level: RiskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

    let requiresApproval = false;
    let autoApproved = false;

    switch (this.config.mode) {
      case 'bypass':
        autoApproved = true;
        break;
      case 'deny-all':
        requiresApproval = true;
        break;
      case 'auto':
        autoApproved = score < this.config.autoApproveThreshold;
        requiresApproval = !autoApproved;
        break;
      case 'interactive':
      default:
        if (level === 'LOW') autoApproved = true;
        else if (level === 'MEDIUM') {
          autoApproved = score < this.config.autoApproveThreshold;
          requiresApproval = !autoApproved;
        } else {
          requiresApproval = true;
        }
    }

    const assessment: RiskAssessment = {
      level,
      score: Math.min(score, 100),
      reasons,
      requiresApproval,
      autoApproved,
      timestamp: Date.now(),
    };

    this.auditLog.push(assessment);
    return assessment;
  }

  private classifyToolType(toolName: string): { score: number; reasons: string[] } {
    const readTools = ['read', 'list', 'search', 'query', 'get', 'fetch', 'load'];
    const writeTools = ['write', 'create', 'update', 'set', 'put', 'post'];
    const destructiveTools = ['delete', 'remove', 'drop', 'destroy', 'purge', 'kill'];
    const execTools = ['bash', 'exec', 'run', 'shell', 'spawn', 'eval'];

    const lower = toolName.toLowerCase();

    if (execTools.some((t) => lower.includes(t))) {
      return { score: 30, reasons: ['Execution tool — shell/process access'] };
    }
    if (destructiveTools.some((t) => lower.includes(t))) {
      return { score: 25, reasons: ['Destructive tool — data deletion risk'] };
    }
    if (writeTools.some((t) => lower.includes(t))) {
      return { score: 15, reasons: ['Write tool — modifies data'] };
    }
    if (readTools.some((t) => lower.includes(t))) {
      return { score: 5, reasons: ['Read tool — safe'] };
    }
    return { score: 10, reasons: ['Unknown tool type'] };
  }

  getAuditLog(): RiskAssessment[] {
    return [...this.auditLog];
  }

  getStats(): { total: number; byLevel: Record<RiskLevel, number>; blocked: number } {
    const byLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    let blocked = 0;
    for (const a of this.auditLog) {
      byLevel[a.level]++;
      if (a.requiresApproval && !a.autoApproved) blocked++;
    }
    return { total: this.auditLog.length, byLevel, blocked };
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }
}

export default RiskClassifier;
