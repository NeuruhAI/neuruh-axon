// AXON Tool Interface Standard — AXON-TIS-001
// Every tool in the system implements this interface.
// Clean-room implementation. No code from external sources.

export type PermissionLevel = 'read' | 'modify' | 'destructive';

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  required: string[];
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AxonTool {
  // Unique identifier for this tool
  name: string;
  // Human-readable description of what this tool does
  description: string;
  // JSON Schema defining the input this tool accepts
  inputSchema: ToolInputSchema;
  // Permission level required to execute this tool
  permissionLevel: PermissionLevel;
  // Execute the tool with validated input
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}
