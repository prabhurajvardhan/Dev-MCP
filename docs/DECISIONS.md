# Architectural Decision Records (ADRs)

## ADR 001: Operational State Store (SQLite + .vibe YAML)
- **Status**: Accepted
- **Context**: Autonomous software development requires ACID transactions for DAG updates and task claims to avoid race conditions, while developers and models need clean, human-readable inspectable files.
- **Decision**: Dual-layer architecture:
  1. `node:sqlite` provides high-performance, synchronous, zero-dependency ACID storage.
  2. `.vibe/` provides human-readable YAML specifications (`requirements.yaml`, `architecture.yaml`, `tasks.yaml`, `checkpoints/`, `observations/`).

## ADR 002: Completion Gate Enforcement
- **Status**: Accepted
- **Context**: LLMs routinely proclaim tasks completed when subtle syntax errors, test failures, or contract violations remain.
- **Decision**: `task_complete` must evaluate git status, git diff, test command, module runnable harness, and contract verifications. On any failure, completion is rejected and a repair task is automatically scheduled.

## ADR 003: Model Neutrality
- **Status**: Accepted
- **Context**: Projects may be worked on consecutively or cooperatively by Claude, GPT, Gemini, Llama, or custom autonomous loops.
- **Decision**: MCP server makes zero model-specific assumptions. Worker identities are strings, and `project_resume` provides a standardized high-density briefing.
