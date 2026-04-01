// AXON File Read Tool — reads file contents
// Permission level: read (auto-approved always)

import { readFileSync, existsSync } from 'fs';
import { AxonTool, ToolResult } from '../types/tool';

export const FileReadTool: AxonTool = {
  name: 'file_read',
  description: 'Read the contents of a file at the given path.',
  permissionLevel: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file.',
        required: true,
      },
      encoding: {
        type: 'string',
        description: 'File encoding. Default utf8.',
      },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    const filePath = input.path as string;
    const encoding = (input.encoding as BufferEncoding) ?? 'utf8';

    if (!existsSync(filePath)) {
      return {
        success: false,
        output: '',
        error: `File not found: ${filePath}`,
      };
    }

    try {
      const content = readFileSync(filePath, encoding);
      return {
        success: true,
        output: content,
        metadata: { path: filePath, bytes: content.length },
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
