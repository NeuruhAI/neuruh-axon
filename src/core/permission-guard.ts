// AXON Permission Guard — AXON-PG-002
// Three-tier permission system. Every tool invocation passes through here.
// Wires to: Neuruh Agentic Trust Layer, OPA Security Suite, Security Protocol

import { PermissionLevel } from '../types/tool';

export type ApprovalMode = 'auto' | 'require_approval' | 'blocked';

export interface PermissionContext {
  userId?: string;
  clientId?: string;
  sessionId: string;
  environment: 'development' | 'staging' | 'production';
}

export interface PermissionDecision {
  approved: boolean;
  reason: string;
  requiresExplicitApproval: boolean;
  auditLog: string;
}

export class PermissionGuard {
  private approvalMode: ApprovalMode;

  constructor(approvalMode: ApprovalMode = 'require_approval') {
    this.approvalMode = approvalMode;
  }

  evaluate(
    toolName: string,
    level: PermissionLevel,
    context: PermissionContext
  ): PermissionDecision {
    const timestamp = new Date().toISOString();
    const auditEntry = `[${timestamp}] tool=${toolName} level=${level} session=${context.sessionId} env=${context.environment}`;

    // Level 1 — READ: file read, search, web fetch. Auto-approved in all modes.
    if (level === 'read') {
      return {
        approved: true,
        reason: 'Read-only operations are auto-approved.',
        requiresExplicitApproval: false,
        auditLog: auditEntry + ' decision=AUTO_APPROVED',
      };
    }

    // Level 2 — MODIFY: file write, bash execution, API calls.
    if (level === 'modify') {
      if (this.approvalMode === 'auto') {
        return {
          approved: true,
          reason: 'Auto-approval mode active for modify operations.',
          requiresExplicitApproval: false,
          auditLog: auditEntry + ' decision=AUTO_APPROVED_MODIFY',
        };
      }
      return {
        approved: false,
        reason: 'Modify operation requires explicit approval.',
        requiresExplicitApproval: true,
        auditLog: auditEntry + ' decision=PENDING_APPROVAL',
      };
    }

    // Level 3 — DESTRUCTIVE: file delete, git force-push, database writes.
    // ALWAYS requires explicit approval. No auto-approve mode bypasses this.
    return {
      approved: false,
      reason: 'Destructive operations always require explicit approval.',
      requiresExplicitApproval: true,
      auditLog: auditEntry + ' decision=BLOCKED_PENDING_EXPLICIT',
    };
  }

  // Call this when the user explicitly approves a pending operation
  grantExplicitApproval(
    toolName: string,
    level: PermissionLevel,
    context: PermissionContext
  ): PermissionDecision {
    const timestamp = new Date().toISOString();
    const auditEntry = `[${timestamp}] tool=${toolName} level=${level} session=${context.sessionId} EXPLICIT_GRANT`;

    if (level === 'read') {
      return this.evaluate(toolName, level, context);
    }

    return {
      approved: true,
      reason: `Explicit approval granted for ${level} operation.`,
      requiresExplicitApproval: false,
      auditLog: auditEntry + ' decision=EXPLICITLY_APPROVED',
    };
  }
}
