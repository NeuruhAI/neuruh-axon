# AXON Phases 2 – 4

Extends the Phase 1 gateway into a full agent framework.

## Phase 2 — Coordinator (MOTHER v2)

**Spec:** AXON-COORD-004 · [`src/core/coordinator.ts`](../src/core/coordinator.ts)

- Task decomposition into subtasks
- Parallel worker spawning
- Shared scratchpad (in-memory or Supabase-backed)
- Result synthesis + verification pass

## Phase 3 — Dream Service + PMLA Memory

**Spec:** AXON-DREAM-005 · [`src/memory/dream-service.ts`](../src/memory/dream-service.ts)

- 5-block PMLA structure: Identity, Context, History, Rules, Handoff
- Background consolidation between sessions
- eta Transform measures compression ratio
- 24-hour + 5-session + lock gate prevents concurrent dreams

## Phase 4 — Prompt Composer + Cost + Budget

**Specs:** AXON-PC-006, AXON-CT-007, AXON-BE-008

- OMNIA-6 layers with per-section cache boundaries
- Token-Swap pattern: master template + swappable variable blocks
- Per-tenant cost accounting feeds Stripe billing
- Budget Enforcer checks spend before every request
