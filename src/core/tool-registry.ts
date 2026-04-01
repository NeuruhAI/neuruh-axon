// AXON Tool Registry — routes all tool calls
// Every tool registers here. Every execution goes through the permission guard.

import { AxonTool, ToolResult } from '../types/tool';
import { PermissionGuard, PermissionContext } from './permission-guard';

export class ToolRegistry {
  private tools: Map<string, AxonTool> = new Map();
  private guard: PermissionGuard;

  constructor(guard: PermissionGuard) {
    this.guard = guard;
  }

  register(tool: AxonTool): void {
    this.tools.set(tool.name, tool);
    console.log(`[AXON Registry] Registered tool: ${tool.name} (${tool.permissionLevel})`);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  get(name: string): AxonTool | undefined {
    return this.tools.get(name);
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: PermissionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool not found: ${toolName}. Registered tools: ${this.list().join(', ')}`,
      };
    }

    const decision = this.guard.evaluate(toolName, tool.permissionLevel, context);
    console.log(`[AXON Guard] ${decision.auditLog}`);

    if (!decision.approved) {
      return {
        success: false,
        output: '',
        error: decision.requiresExplicitApproval
          ? `Requires explicit approval: ${decision.reason}`
          : `Blocked: ${decision.reason}`,
        metadata: { requiresApproval: decision.requiresExplicitApproval },
      };
    }

    try {
      return await tool.execute(input);
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
