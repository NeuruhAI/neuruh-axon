// AXON Bash Tool — executes shell commands
// Permission level: modify (requires approval in non-auto mode)

import { execSync } from 'child_process';
import { AxonTool, ToolResult } from '../types/tool';

export const BashTool: AxonTool = {
  name: 'bash',
  description: 'Execute a shell command and return stdout/stderr.',
  permissionLevel: 'modify',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
        required: true,
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds. Default 10000.',
      },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = input.command as string;
    const timeout = (input.timeout as number) ?? 10000;

    try {
      const output = execSync(command, {
        timeout,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output.trim() };
    } catch (err: unknown) {
      const error = err as { message?: string; stderr?: string; stdout?: string };
      return {
        success: false,
        output: error.stdout ?? '',
        error: error.stderr ?? error.message ?? 'Unknown error',
      };
    }
  },
};
