// AXON Web Fetch Tool — fetches a URL and returns content
// Permission level: read (auto-approved always)

import { AxonTool, ToolResult } from '../types/tool';

export const WebFetchTool: AxonTool = {
  name: 'web_fetch',
  description: 'Fetch the content of a URL and return the response body.',
  permissionLevel: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch.',
        required: true,
      },
      method: {
        type: 'string',
        description: 'HTTP method. Default GET.',
      },
    },
    required: ['url'],
  },
  async execute(input): Promise<ToolResult> {
    const url = input.url as string;
    const method = (input.method as string) ?? 'GET';

    try {
      const response = await fetch(url, { method });
      const body = await response.text();

      if (!response.ok) {
        return {
          success: false,
          output: body,
          error: `HTTP ${response.status}: ${response.statusText}`,
          metadata: { status: response.status, url },
        };
      }

      return {
        success: true,
        output: body,
        metadata: { status: response.status, url, contentLength: body.length },
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
