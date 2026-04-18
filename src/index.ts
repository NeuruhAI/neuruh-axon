// AXON Gateway — Entry Point
// Neuruh MCP Gateway v1.0 — Phase 1
// Architecture: AXON-TIS-001 through AXON-PG-002

import { PermissionGuard } from './core/permission-guard';
import { ToolRegistry } from './core/tool-registry';
import { BashTool } from './tools/bash-tool';
import { FileReadTool } from './tools/file-read-tool';
import { WebFetchTool } from './tools/web-fetch-tool';
import { emit } from './telemetry/emit';

async function main() {
  console.log('[AXON] Neuruh MCP Gateway v1.0 — Phase 1 Boot');
  emit('AXON-001', 'axon-boot', 'start');

  // Initialize permission guard in require_approval mode (safe default)
  const guard = new PermissionGuard('require_approval');

  // Initialize tool registry
  const registry = new ToolRegistry(guard);

  // Register Phase 1 tools
  registry.register(FileReadTool);
  registry.register(WebFetchTool);
  registry.register(BashTool);

  console.log(`[AXON] ${registry.list().length} tools registered: ${registry.list().join(', ')}`);

  // Test context
  const context = {
    sessionId: `axon-test-${Date.now()}`,
    environment: 'development' as const,
  };

  // Smoke test — read this file
  console.log('\n[AXON] Smoke test: file_read on src/index.ts');
  emit('AXON-PG-001', 'file_read-call', 'execute');
  const result = await registry.execute('file_read', { path: './src/index.ts' }, context);
  console.log(`[AXON] Result: success=${result.success} bytes=${result.metadata?.bytes ?? 0}`);

  // Smoke test — web fetch
  console.log('\n[AXON] Smoke test: web_fetch on example.com');
  emit('AXON-PG-002', 'web_fetch-call', 'execute');
  const webResult = await registry.execute('web_fetch', { url: 'https://example.com' }, context);
  console.log(`[AXON] Result: success=${webResult.success} status=${webResult.metadata?.status}`);

  // Smoke test — bash (blocked, requires approval)
  console.log('\n[AXON] Smoke test: bash (should be blocked — requires approval)');
  emit('AXON-TIS-001', 'bash-call', 'execute');
  const bashResult = await registry.execute('bash', { command: 'echo hello' }, context);
  console.log(`[AXON] Result: success=${bashResult.success} error=${bashResult.error ?? 'none'}`);

  console.log('\n[AXON] Phase 1 boot complete. All systems nominal.');
}

main().catch(console.error);
