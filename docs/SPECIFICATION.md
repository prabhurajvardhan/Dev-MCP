# Technical Specification: State Transitions and Contracts

## 1. Task State Machine Specification

### Formal States:
- `BLOCKED`: Task has unsatisfied prerequisite dependencies (`dependencies` contains tasks not in `VERIFIED` state).
- `READY`: All prerequisite dependencies are `VERIFIED`. The task can be claimed by an idle worker.
- `CLAIMED`: A specific worker has reserved the task (`assignedWorkerId` set).
- `BUILDING`: Implementation is actively underway.
- `VERIFYING`: The task has been submitted to the Completion Gate.
- `VERIFIED`: The Completion Gate passed with verified observable evidence.
- `INTEGRATING`: Multi-module end-to-end integration is verifying the whole system.
- `FAILED`: Verification or build failed. Automatically generates a Repair Task in `READY` state.

### State Transition Invariant:
A worker can **never** transition a task directly from `BUILDING` to `VERIFIED`. Any attempt to complete a task triggers the Completion Gate; only an affirmative gate result promotes the task to `VERIFIED`.

## 2. Observable Contract Specification

Every module specifies an observable contract:
```typescript
interface ObservableContractSpec {
  harnessCommand: string;
  expectedExitCode: number;
  stdoutPattern?: string;
  jsonSchemaCheck?: Record<string, unknown>;
  timeoutMs: number;
  evidenceType: 'CLI' | 'HTTP_API' | 'DATABASE' | 'FILE_SYSTEM' | 'BROWSER_UI' | 'STRUCTURED_AI';
}
```

## 3. Repair Task Generation

When verification fails, the task transitions to `FAILED` and a corresponding repair task is synthesized:
- `title`: `Repair: Fix failure in '${originalTask.title}'`
- `priority`: `CRITICAL`
- `state`: `READY`
- `repairContext`:
  - `failureReason`: Detailed diagnostic failure string.
  - `failingCommand`: The exact command that errored out.
  - `stdout` & `stderr`: Captured execution output.
  - `affectedFiles`: List of changed files detected during the attempt.
  - `suggestedAction`: Remediation guidance for the next worker.
