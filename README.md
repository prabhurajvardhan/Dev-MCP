# VIBE ENGINEERING MCP

> **An Agentic Software-Engineering Control Plane** that manages requirements, architecture, tasks, workspaces, execution, verification, integration, and checkpoints for autonomous software development.

[![CI](https://github.com/vibe-engineering/vibe-engineering-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vibe-engineering/vibe-engineering-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](tsconfig.json)

---

## 💡 Core Philosophy

### LLM = WORKER INTELLIGENCE
### MCP = ENGINEERING OPERATING SYSTEM / CONTROL PLANE

The LLM is **not** the source of truth for project state. The MCP owns:
* Requirements & Architecture
* Modules, Interfaces, and Contracts
* Task Dependency DAG & State Machine
* Worker Assignments & Isolated Workspaces
* Observable Evidence Collection & Verification Gates
* Checkpoints & Cold Resumption Context

Different AI models (Claude, GPT-4, Gemini, Mistral, Llama, custom agents) act as interchangeable workers. The worker provides raw cognitive intelligence; the MCP provides engineering governance and verified state control.

---

## 🎯 The Observable Contract Principle

A task is **NOT** complete merely because an LLM says: *"Done."*

A capability is complete only when:
$$\text{IMPLEMENTATION} + \text{RUNNABLE HARNESS} + \text{OBSERVABLE OUTPUT} + \text{CONTRACT VERIFICATION} + \text{INTEGRATION VERIFICATION} + \text{CHECKPOINT}$$
have all succeeded with reproducible evidence.

Every module must implement an observable harness:
```
INPUT  ──>  MODULE  ──>  OBSERVABLE OUTPUT  ──>  CONTRACT VERIFIER
```

Modality observation mechanisms:
- **CLI**: `command` $\to$ `stdout/stderr/exit code`
- **HTTP API**: `request` $\to$ `response status/headers/payload`
- **Database**: `query` $\to$ `reproducible database state`
- **Structured AI**: `prompt` $\to$ `strict JSON schema`
- **Web UI**: `Playwright` $\to$ `DOM state / visual artifact`

---

## 🔄 Task State Machine & Completion Gate

Tasks progress through strict state machine transitions:

```
        BLOCKED
           │  (Prerequisite dependencies reach VERIFIED)
           ▼
         READY
           │  (Worker claims task via task_claim)
           ▼
        CLAIMED
           │  (Worker begins implementation)
           ▼
       BUILDING
           │  (Worker calls task_complete)
           ▼
       VERIFYING ──────► FAILED ──► AUTO REPAIR TASK ──► READY
           │
           │ (Completion Gate Passes:
           │  Git diff + Tests + Observable Harness + Contract)
           ▼
        VERIFIED
           │
           ▼
      INTEGRATING ───► VERIFIED (System Integration Pass)
```

### The Completion Gate (`task_complete`)
When `task_complete` is invoked:
1. Inspects git working tree and changed files.
2. Inspects git diff.
3. Executes unit and component tests.
4. Executes the module's registered **Observable Harness**.
5. Captures cryptographic artifact hashes and telemetry.
6. Enforces interface contract rules (exit codes, regex patterns, JSON schemas).
7. Checks cross-module integration requirements.
8. If all pass: marks task `VERIFIED`, updates DAG readiness for dependent tasks, and records state.
9. If any check fails: transitions task to `FAILED` and generates an **Automated Repair Task** in state `READY` containing the exact failure reason, failing command, stderr, affected files, and suggested repair action.

---

## 🛠️ MCP Tools Reference

| Category | Tool | Description |
|---|---|---|
| **PROJECT** | `project_initialize` | Initializes or connects to a project with SQLite state & `.vibe/` |
| | `project_inspect` | Full operational snapshot (DAG counts, git status, active workers) |
| | `project_resume` | High-density context for cold worker model continuation |
| **REQUIREMENTS** | `requirements_compile` | Compiles user requirements into structured capabilities & criteria |
| **ARCHITECTURE** | `architecture_generate` | Records modular boundaries, entrypoints, and contracts |
| | `architecture_validate` | Validates DAG acyclicity and interface consistency |
| **TASKS** | `task_next` | Returns next highest priority `READY` task (prioritizes repair tasks) |
| | `task_claim` | Assigns a `READY` task to a worker model |
| | `task_complete` | Evaluates task through Completion Gate (Diff + Tests + Harness) |
| | `task_fail` | Explicitly fails a task and records error diagnostic |
| **WORKSPACE** | `workspace_create` | Creates isolated branch/workspace for safe concurrent work |
| | `workspace_status` | Lists all active worker workspaces |
| **REPOSITORY** | `repo_read_file` | Safe file read bounded by project path containment |
| | `repo_write_file` | Safe atomic file write bounded by project root |
| | `repo_delete_file` | Safe file deletion within workspace |
| **TERMINAL** | `terminal_exec` | Scoped terminal command execution with security policy and logging |
| **GIT** | `git_status` | Returns git status, staged, modified, and untracked files |
| | `git_diff` | Returns working tree or cached diff |
| | `git_commit` | Stages changes and creates git commit |
| | `git_branch` | Creates and checks out a new branch |
| | `git_merge` | Merges branch with `--no-ff` |
| **MODULES** | `module_run` | Executes module harness and captures execution metrics |
| | `module_observe` | Records reproducible observable evidence |
| **VERIFICATION** | `contract_verify` | Evaluates evidence against contract rules |
| | `integration_verify` | Executes cross-module integration test harness |
| **CHECKPOINTS** | `checkpoint_create` | Records comprehensive snapshot (SHA, capabilities, DAG, decisions) |
| | `checkpoint_load` | Loads historic milestone checkpoint |

---

## 📁 Repository Structure

```
├── .github/workflows/ci.yml       # Automated CI (lint, build, vitest)
├── .vibe/                         # Human-readable inspectable project artifacts
│   ├── architecture.yaml
│   ├── requirements.yaml
│   ├── system-design.yaml
│   ├── modules.yaml
│   ├── tasks.yaml
│   ├── contracts/
│   ├── checkpoints/
│   └── observations/
├── src/
│   ├── server/
│   │   ├── index.ts               # MCP Server entry point (Stdio transport)
│   │   └── tools/                 # 9 modular tool registration groups
│   ├── engine/
│   │   ├── project-engine.ts      # Project lifecycle & requirements
│   │   ├── task-engine.ts         # State machine & repair task generator
│   │   ├── scheduler.ts           # Task dependency DAG & priority scheduler
│   │   ├── contracts.ts           # Contract evaluation rules
│   │   ├── verification.ts        # Completion Gate
│   │   ├── integration.ts         # Cross-module integration tests
│   │   └── checkpoint.ts          # State checkpointing & resume generator
│   ├── storage/
│   │   ├── sqlite.ts              # SQLite operational ACID store
│   │   └── vibe-file-store.ts     # .vibe/ YAML synchronization
│   ├── execution/
│   │   ├── workspace-manager.ts   # Worker isolation (branches/worktrees)
│   │   ├── command-runner.ts      # Scoped execution & audit logging
│   │   ├── git-manager.ts         # Git version control
│   │   ├── module-runner.ts       # Executable harnesses
│   │   └── observer.ts            # Observable evidence collector
│   ├── models/                    # Zod schemas & TypeScript models
│   ├── security/
│   │   ├── command-policy.ts      # Command whitelisting & safety policy
│   │   └── path-policy.ts         # Path containment & traversal prevention
│   └── utils/
├── tests/
│   ├── unit/                      # State store, scheduler, policy, contracts
│   └── integration/               # Completion gate, MCP server, 19-step loop
└── docs/                          # Architecture, specification, decisions
```

---

## 🚀 Getting Started

### 1. Installation

```bash
git clone https://github.com/vibe-engineering/vibe-engineering-mcp.git
cd vibe-engineering-mcp
npm install
```

### 2. Run Test Suite

```bash
npm test
```

### 3. Start MCP Server (Stdio)

```bash
npm run mcp
```

### 4. Configure in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibe-engineering": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/vibe-engineering-mcp/src/server/index.ts"]
    }
  }
}
```

### 5. Configure in Cursor

Under **Cursor Settings** $\to$ **Features** $\to$ **MCP Servers**:
- Name: `vibe-engineering`
- Type: `command`
- Command: `npx -y tsx /path/to/vibe-engineering-mcp/src/server/index.ts`

---

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
