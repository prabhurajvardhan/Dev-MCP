# VIBE ENGINEERING MCP

> **An Agentic Software-Engineering Operating System & Control Plane** that manages requirements, architecture, tasks, workspaces, execution, verification, integration, and checkpoints for autonomous software development.

[![CI](https://github.com/prabhurajvardhan/Dev-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/prabhurajvardhan/Dev-MCP/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_NodeNext-blue)](tsconfig.json)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-V2_(@modelcontextprotocol/server)-green)](https://ts.sdk.modelcontextprotocol.io/v2/)

---

## 💡 Core Philosophy

```
  ┌──────────────────────────────────────────────────────────────┐
  │                 WORKER INTELLIGENCE (LLM)                    │
  │        (Claude Code, Cursor, Gemini, GPT, Custom Agent)      │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ JSON-RPC / MCP Protocol
  ┌──────────────────────────────▼───────────────────────────────┐
  │              ENGINEERING CONTROL PLANE (MCP)                 │
  │                     Vibe Engineering MCP                     │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
┌────▼─────────────────┐   ┌─────▼────────────────┐   ┌──────▼─────────────────┐
│ Task DAG Scheduler   │   │  Completion Gate     │   │ Checkpoint & Resumption│
│ Cycle Detection      │   │  Observable Harness  │   │ Git Commit Snapshots   │
│ Topological Ordering │   │  Contract Verifier   │   │ Worker Continuation    │
└────┬─────────────────┘   └─────┬────────────────┘   └──────┬─────────────────┘
     │                           │                           │
     └───────────────────────────┼───────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────┐
  │              ISOLATION & EXECUTION POLICIES                  │
  │   Git Worktrees  ·  Command Policy  ·  Path Policy  · Observer │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────┴───────────────────────────────┐
  │                   DUAL-LAYER STATE STORAGE                   │
  │       SQLite (ACID Operational DB)  ·  .vibe/ (YAML Specs)   │
  └──────────────────────────────────────────────────────────────┘
```

* **The LLM is NOT the source of truth for project state.**
* **The MCP server is the engineering operating system.**
* A task cannot become `VERIFIED` merely because an LLM claims it is finished.
* A capability is complete only when:
  $$\text{Implementation} + \text{Runnable Harness} + \text{Observable Output} + \text{Contract Verification} + \text{Integration Compatibility} + \text{Checkpoint}$$
  have all passed with reproducible evidence.

---

## 🔄 Task State Machine & Completion Gate

Tasks progress through strict state machine transitions:

$$\text{BLOCKED} \longrightarrow \text{READY} \longrightarrow \text{CLAIMED} \longrightarrow \text{BUILDING} \longrightarrow \text{VERIFYING} \longrightarrow \text{VERIFIED} \longrightarrow \text{INTEGRATING} \longrightarrow \text{VERIFIED}$$

### The Completion Gate (`task_complete`)
When `task_complete` is invoked by a worker:
1. Inspects the task and active workspace.
2. Inspects Git working tree and modified files.
3. Inspects Git diff.
4. Executes unit and component tests.
5. Runs the module's registered **Observable Harness** (CLI, HTTP, DB, AI, UI).
6. Captures standard output, standard error, exit code, and execution time.
7. Evaluates contract rules (exit codes, regex patterns, JSON schema verification, artifact existence).
8. Checks cross-module integration requirements.
9. **On Pass**: Transitions task to `VERIFIED`, updates DAG readiness for dependent tasks, and records state.
10. **On Fail**: Rejects completion, transitions task to `FAILED`, and automatically schedules an **Automated Repair Task** in state `READY` populated with:
    * Original task ID
    * Failure reason
    * Failing command
    * Relevant stdout/stderr
    * Affected files
    * Suggested remediation action

---

## 🛡️ Git Worktree Workspace Isolation

Unlike naive implementations that share or pollute the project root directory, Vibe Engineering MCP provisions dedicated **Git worktrees** for each worker/task:
* Worktrees are created under `.worktrees/ws-<workerId>-<taskId>` on isolated Git branches (`worker/<workerId>/task-<taskId>`).
* The system never silently falls back to the project root. If worktree provisioning fails, it throws an explicit diagnostic error.
* Worktree metadata is fully tracked (`workspaceId`, `taskId`, `branch`, `worktreePath`, `repositoryPath`, `status`, `createdAt`).
* Worktrees can be safely cleaned up with `cleanupWorkspace` (`git worktree remove --force`).

---

## 🔒 Security Model

### Command Policy (`src/security/command-policy.ts`)
* Scopes terminal command execution to the project or designated worktree.
* Blocks destructive commands (`rm -rf /`, formatting disks via `mkfs`, overwrite via `dd`, fork bombs `:(){ :|:& };:`, unauthorized `sudo`).
* Requires execution inside valid workspace boundaries.
* Every command execution records: execution ID, command, cwd, timestamp, exit code, stdout, stderr, and duration to SQLite.

### Path Policy (`src/security/path-policy.ts`)
* Enforces strict containment within project/worktree root.
* Resolves symlinks and prevents directory traversal attacks (e.g. `../../etc/passwd`).

---

## 🛠️ Registered MCP Tools (28 Tools)

Migrated to the current **MCP TypeScript SDK V2** (`@modelcontextprotocol/server`):

| Category | Tool | Description |
|---|---|---|
| **PROJECT** | `project_initialize` | Initializes or connects to a project with SQLite state & `.vibe/` directory |
| | `project_inspect` | Full operational snapshot (DAG counts, git status, active workers) |
| | `project_resume` | High-density context briefing for cold model resumption |
| **REQUIREMENTS** | `requirements_compile` | Compiles human specifications into structured capabilities & criteria |
| **ARCHITECTURE** | `architecture_generate` | Records modular boundaries, entrypoints, and contracts |
| | `architecture_validate` | Validates DAG acyclicity and interface consistency |
| **TASKS** | `task_create` | Creates a new task with dependencies and observable contract specification |
| | `task_next` | Returns next highest priority `READY` task (prioritizes repair tasks) |
| | `task_claim` | Assigns a `READY` task to a worker model |
| | `task_complete` | Evaluates task through Completion Gate with auto-repair synthesis |
| | `task_fail` | Explicitly marks a task as `FAILED` with diagnostic reason |
| **WORKSPACE** | `workspace_create` | Creates isolated Git worktree and branch for a worker |
| | `workspace_status` | Inspects all active worker workspaces |
| **REPOSITORY** | `repo_read_file` | Safe file read bounded by workspace containment |
| | `repo_write_file` | Safe atomic file write bounded by workspace root |
| | `repo_delete_file` | Safe workspace file deletion |
| **TERMINAL** | `terminal_exec` | Policy-checked scoped terminal command execution |
| **GIT** | `git_status` | Returns working tree status, staged, modified, and untracked files |
| | `git_diff` | Returns working tree or cached diff |
| | `git_commit` | Stages changes and creates git commit |
| | `git_branch` | Creates and checks out branch |
| | `git_merge` | Merges branch with `--no-ff` |
| **MODULES** | `module_run` | Executes module runnable harness and captures metrics |
| | `module_observe` | Records reproducible observable evidence |
| **VERIFICATION** | `contract_verify` | Evaluates evidence against contract rules |
| | `integration_verify` | Executes cross-module integration test harness |
| **CHECKPOINTS** | `checkpoint_create` | Records comprehensive snapshot (SHA, capabilities, DAG, decisions) |
| | `checkpoint_load` | Loads historic milestone checkpoint |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.0.0` or higher (Tested on Node 22 with built-in `node:sqlite`)
* **Git**: `2.30+` with worktree support

### Installation
```bash
git clone https://github.com/prabhurajvardhan/Dev-MCP.git
cd Dev-MCP
npm ci
```

### Typecheck & Test Suite
```bash
npm run typecheck
npm test
```
The test suite includes:
* 4 Unit test suites: Task DAG scheduler, SQLite state store, command security policy, contract engine.
* 4 Integration test suites: Real MCP client protocol over stdio (`@modelcontextprotocol/client`), 19-step autonomous engineering loop, task completion gate & repair generation, MCP server tools interface.

### Build Project
```bash
npm run build
```
Compiles TypeScript into `./dist`.

---

## 🔌 Running the MCP Server (Stdio)

The MCP server uses pure stdio JSON-RPC transport (`serveStdio`).
* Standard output (`stdout`) is strictly reserved for JSON-RPC messages.
* All logging and diagnostic outputs are routed to `stderr`.

```bash
npm run mcp
# or
npx tsx src/server/index.ts
```

### Configuration in Claude Code / Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vibe-engineering": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/Dev-MCP/src/server/index.ts"]
    }
  }
}
```

### Configuration in Cursor
In **Cursor Settings** $\to$ **Features** $\to$ **MCP Servers**:
* **Name**: `vibe-engineering`
* **Type**: `command`
* **Command**: `npx -y tsx /path/to/Dev-MCP/src/server/index.ts`

---

## 📂 `.vibe/` Inspectable Project State

In addition to SQLite operational ACID storage, human-readable YAML state is maintained under `.vibe/`:
```
.vibe/
├── architecture.yaml       # System design, modular boundaries, contracts
├── requirements.yaml       # Product goals & acceptance criteria
├── modules.yaml            # Registered modules & runnable harnesses
├── tasks.yaml              # Task DAG and execution status
├── checkpoints/            # Frozen capability snapshots (latest.yaml + chk-*.yaml)
├── contracts/              # Interface contracts
├── observations/           # Reproducible evidence logs (evd-*.yaml)
└── decisions/              # Architectural decision records
```

---

## ⚠️ Current Scope & Limitations (V0)

* **Local Focus**: V0 is optimized for single-machine local development using Git worktrees and SQLite.
* **No Remote Workers**: Distributed worker pools or cloud message brokers are deferred to V1.
* **Synchronous Worktree Operations**: Worktree allocation is local to the filesystem where the MCP server runs.

---

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
