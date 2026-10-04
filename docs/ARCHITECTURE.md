# Architectural Design: Vibe Engineering Control Plane

## Abstract
Autonomous software engineering by Large Language Models frequently suffers from amnesia, unverified hallucinations, phantom completions, and context degradation. Vibe Engineering MCP formalizes software development as a stateful, verifiable, and resumable engineering operating system.

## Layered Architecture

```
                  ┌─────────────────────────────────────┐
                  │          Worker Intelligence        │
                  │ (Claude, GPT, Gemini, Llama, Agent) │
                  └──────────────────┬──────────────────┘
                                     │ JSON-RPC / MCP Transport (Stdio, HTTP)
                  ┌──────────────────▼──────────────────┐
                  │         MCP Protocol Gateway        │
                  │  (project, tasks, git, repo, gate)  │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
┌──────────▼─────────┐    ┌──────────▼─────────┐    ┌──────────▼─────────┐
│   Planning & DAG   │    │  Verification Gate │    │ Checkpoint Engine  │
│  TaskScheduler     │    │ CompletionVerifier │    │ CheckpointManager  │
│  Cycle Detection   │    │ ContractEngine     │    │ ResumeContext      │
└──────────┬─────────┘    └──────────┬─────────┘    └──────────┬─────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
                  ┌──────────────────▼──────────────────┐
                  │       Execution & Isolation         │
                  │   CommandRunner  ·  GitManager      │
                  │ WorkspaceManager ·  Observer        │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
┌──────────▼─────────┐                               ┌─────────▼──────────┐
│   Operational DB   │                               │ Human-Inspectable  │
│    node:sqlite     │                               │      .vibe/        │
│ ACID state machine │                               │  YAML specs & logs │
└────────────────────┘                               └────────────────────┘
```

## Fundamental Units
1. **Capability**: A self-contained functional slice with observable behavior.
2. **Runnable Harness**: An automated execution command that exercises a capability.
3. **Evidence**: Cryptographically hashed observable artifacts and execution outputs.
4. **Completion Gate**: An immutable threshold preventing unverified task completion.
5. **Cold Resumption Context**: A dense, structured payload allowing any new model instance to seamlessly continue development without re-reading the whole conversation history.
