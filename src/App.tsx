import React, { useState } from 'react';
import {
  Terminal,
  Cpu,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  FileCode,
  ArrowRight,
  Database,
  RefreshCw,
  Workflow,
  Sparkles,
  Lock,
  Boxes,
  Activity
} from 'lucide-react';

interface ToolDef {
  name: string;
  category: string;
  description: string;
}

const MCP_TOOLS: ToolDef[] = [
  { name: 'project_initialize', category: 'Project', description: 'Initializes project with SQLite state & .vibe/ directory' },
  { name: 'project_inspect', category: 'Project', description: 'Full operational status report (tasks, modules, git, checkpoint)' },
  { name: 'project_resume', category: 'Project', description: 'High-density context briefing for cold model resumption' },
  { name: 'requirements_compile', category: 'Requirements', description: 'Compiles human specs into structured capabilities' },
  { name: 'architecture_generate', category: 'Architecture', description: 'Synthesizes system design, modules, and interfaces' },
  { name: 'architecture_validate', category: 'Architecture', description: 'Validates DAG acyclicity and interface completeness' },
  { name: 'task_next', category: 'Tasks', description: 'Returns next READY task from dependency DAG' },
  { name: 'task_claim', category: 'Tasks', description: 'Claims a READY task for a specific worker model' },
  { name: 'task_complete', category: 'Tasks', description: 'Evaluates task via Completion Gate with repair synthesis' },
  { name: 'task_fail', category: 'Tasks', description: 'Explicitly marks task as FAILED with diagnostic reasons' },
  { name: 'workspace_create', category: 'Workspace', description: 'Creates isolated branch and workspace directory' },
  { name: 'workspace_status', category: 'Workspace', description: 'Inspects all active worker workspaces' },
  { name: 'repo_read_file', category: 'Repository', description: 'Path-contained safe file reading' },
  { name: 'repo_write_file', category: 'Repository', description: 'Path-contained atomic file writing' },
  { name: 'repo_delete_file', category: 'Repository', description: 'Safe workspace file deletion' },
  { name: 'terminal_exec', category: 'Terminal', description: 'Policy-checked scoped terminal command execution' },
  { name: 'git_status', category: 'Git', description: 'Inspects staged, modified, and untracked files' },
  { name: 'git_diff', category: 'Git', description: 'Inspects working tree or cached commit diff' },
  { name: 'git_commit', category: 'Git', description: 'Creates structured git commit' },
  { name: 'git_branch', category: 'Git', description: 'Creates and checks out feature branch' },
  { name: 'git_merge', category: 'Git', description: 'Merges feature branch with --no-ff' },
  { name: 'module_run', category: 'Modules', description: 'Executes module runnable harness and captures metrics' },
  { name: 'module_observe', category: 'Modules', description: 'Records reproducible observable evidence' },
  { name: 'contract_verify', category: 'Verification', description: 'Validates evidence against contract rules' },
  { name: 'integration_verify', category: 'Verification', description: 'Runs cross-module integration test suites' },
  { name: 'checkpoint_create', category: 'Checkpoints', description: 'Snapshots commit SHA, capabilities, and active tasks' },
  { name: 'checkpoint_load', category: 'Checkpoints', description: 'Loads historic milestone checkpoint' },
];

const TASK_STAGES = [
  { id: 'BLOCKED', label: 'Blocked', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  { id: 'READY', label: 'Ready', color: 'bg-blue-950/70 text-blue-400 border-blue-800' },
  { id: 'CLAIMED', label: 'Claimed', color: 'bg-purple-950/70 text-purple-400 border-purple-800' },
  { id: 'BUILDING', label: 'Building', color: 'bg-amber-950/70 text-amber-400 border-amber-800' },
  { id: 'VERIFYING', label: 'Verifying', color: 'bg-cyan-950/70 text-cyan-400 border-cyan-800' },
  { id: 'VERIFIED', label: 'Verified', color: 'bg-emerald-950/70 text-emerald-400 border-emerald-800' },
  { id: 'INTEGRATING', label: 'Integrating', color: 'bg-indigo-950/70 text-indigo-400 border-indigo-800' },
  { id: 'FAILED', label: 'Failed', color: 'bg-rose-950/70 text-rose-400 border-rose-800' },
];

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'statemachine' | 'loop' | 'resume'>('overview');

  const categories = ['All', ...Array.from(new Set(MCP_TOOLS.map((t) => t.category)))];
  const filteredTools = selectedCategory === 'All'
    ? MCP_TOOLS
    : MCP_TOOLS.filter((t) => t.category === selectedCategory);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-zinc-100 text-base tracking-tight">VIBE ENGINEERING MCP</h1>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                V0.1.0 Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">Agentic Software-Engineering Operating System & Control Plane</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'overview' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'tools' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            MCP Tools ({MCP_TOOLS.length})
          </button>
          <button
            onClick={() => setActiveTab('statemachine')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'statemachine' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completion Gate
          </button>
          <button
            onClick={() => setActiveTab('loop')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'loop' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            19-Step E2E Loop
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'resume' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cold Resumption
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Core Formula Banner */}
        <div className="p-5 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Axiomatic Foundation
            </div>
            <div className="text-lg font-medium text-zinc-200 flex flex-wrap items-center gap-2">
              <span className="text-zinc-400">LLM =</span> Worker Intelligence
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">MCP =</span> Engineering Operating System
            </div>
            <p className="text-xs text-zinc-400">
              The LLM does not own state. The MCP enforces requirements, architecture, dependency DAGs, observable evidence, and completion gates.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
              15 / 15 Tests Passing
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono">
              Transport: Stdio + JSON-RPC
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 3 Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Workflow className="w-4 h-4" />
                </div>
                <h3 className="font-medium text-sm text-zinc-200">Autonomous DAG Scheduler</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Dependency-ordered topological execution with cycle detection. Tasks transition from BLOCKED to READY automatically when prerequisites reach VERIFIED.
                </p>
                <div className="text-[11px] font-mono text-blue-400/80 bg-blue-950/30 px-2 py-1 rounded border border-blue-900/50">
                  task_next · task_claim · task_fail
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-medium text-sm text-zinc-200">The Completion Gate</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  A task is never complete merely because a model says "Done". Requires implementation + runnable harness + observable output + contract verification.
                </p>
                <div className="text-[11px] font-mono text-emerald-400/80 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
                  task_complete · auto-repair synthesis
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="font-medium text-sm text-zinc-200">Cold Resumption & Checkpoints</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Complete state snapshots enabling completely fresh models (Claude, GPT, Gemini, Llama) to resume project execution seamlessly without context decay.
                </p>
                <div className="text-[11px] font-mono text-purple-400/80 bg-purple-950/30 px-2 py-1 rounded border border-purple-900/50">
                  checkpoint_create · project_resume
                </div>
              </div>
            </div>

            {/* Architecture Slice */}
            <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Dual-Storage Control Plane
                </h3>
                <span className="text-xs text-zinc-500 font-mono">SQLite (ACID) + .vibe/ (YAML Specs)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="font-mono text-emerald-400 font-semibold flex items-center gap-2">
                    <span>1. SQLite Operational DB</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">node:sqlite</span>
                  </div>
                  <p className="text-zinc-400">
                    Provides synchronous ACID transactions for projects, task state transitions, module contracts, captured telemetry, and command execution logs.
                  </p>
                  <ul className="text-zinc-500 list-disc list-inside space-y-1 font-mono text-[11px]">
                    <li>projects, tasks, task_dependencies</li>
                    <li>modules, contracts, evidence</li>
                    <li>checkpoints, command_logs, workers</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="font-mono text-blue-400 font-semibold flex items-center gap-2">
                    <span>2. Human-Inspectable .vibe/</span>
                    <span className="text-[10px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800">YAML Artifacts</span>
                  </div>
                  <p className="text-zinc-400">
                    Maintains human-readable, version-controlled architecture artifacts synchronized with the operational database for team auditability.
                  </p>
                  <ul className="text-zinc-500 list-disc list-inside space-y-1 font-mono text-[11px]">
                    <li>.vibe/requirements.yaml, architecture.yaml</li>
                    <li>.vibe/modules.yaml, tasks.yaml</li>
                    <li>.vibe/contracts/, checkpoints/, observations/</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TOOLS */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTools.map((tool) => (
                <div key={tool.name} className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400">{tool.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STATE MACHINE & COMPLETION GATE */}
        {activeTab === 'statemachine' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                <Workflow className="w-4 h-4 text-emerald-400" />
                8-State Task Lifecycle
              </h3>
              <p className="text-xs text-zinc-400">
                Workers can never bypass verification. State machine enforces: BLOCKED $\to$ READY $\to$ CLAIMED $\to$ BUILDING $\to$ VERIFYING $\to$ VERIFIED.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {TASK_STAGES.map((stage) => (
                  <div key={stage.id} className={`p-3 rounded-lg border ${stage.color} flex flex-col justify-between`}>
                    <div className="font-mono font-bold text-xs">{stage.id}</div>
                    <div className="text-[11px] opacity-80 mt-1">{stage.label} State</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completion Gate Steps */}
            <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Task Completion Gate Pipeline (`task_complete`)
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="font-mono text-emerald-400 font-bold">1</div>
                  <div>
                    <span className="font-medium text-zinc-200">Git Working Tree & Diff Inspection</span>
                    <p className="text-zinc-400">Audits modified, staged, and untracked files to guarantee scoped changes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="font-mono text-emerald-400 font-bold">2</div>
                  <div>
                    <span className="font-medium text-zinc-200">Automated Test Execution</span>
                    <p className="text-zinc-400">Executes designated unit and component test suites.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="font-mono text-emerald-400 font-bold">3</div>
                  <div>
                    <span className="font-medium text-zinc-200">Observable Harness Run & Telemetry Capture</span>
                    <p className="text-zinc-400">Runs the module's registered execution harness (CLI, HTTP, UI) and captures stdout, stderr, exit code, and execution time.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="font-mono text-emerald-400 font-bold">4</div>
                  <div>
                    <span className="font-medium text-zinc-200">Contract Rule Verification</span>
                    <p className="text-zinc-400">Validates stdout patterns, exit code invariants, JSON schema fields, and artifact existence.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-amber-900/40">
                  <div className="font-mono text-amber-400 font-bold">5</div>
                  <div>
                    <span className="font-medium text-amber-200">On Failure: Automatic Repair Task Synthesis</span>
                    <p className="text-zinc-400">If any check fails, task becomes FAILED. An automated Repair Task is generated in READY state with failure reason, failing command, and suggestions.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 19-STEP E2E LOOP */}
        {activeTab === 'loop' && (
          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                The 19-Step Autonomous Engineering Loop
              </h3>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                100% Tested & Verified in Vitest
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                '1. project.initialize creates project record and .vibe/ structure',
                '2. SQLite schema initializes operational tables',
                '3. Module definition registered with executable harness',
                '4. Task created in dependency DAG with contract specification',
                '5. task.next identifies ready unblocked task',
                '6. task.claim assigns worker model identifier',
                '7. workspace.create establishes isolated branch/workspace',
                '8. repo.write_file outputs implementation code safely',
                '9. terminal.exec runs scoped validation commands',
                '10. module.run executes module harness',
                '11. module.observe captures reproducible telemetry and hashes',
                '12. contract.verify validates against acceptance criteria',
                '13. git.status inspects working directory modifications',
                '14. git.diff reviews code alterations',
                '15. git.commit creates structured atomic commit',
                '16. task.complete runs Completion Gate and marks VERIFIED',
                '17. checkpoint.create freezes capability snapshot',
                '18. project.resume invoked for completely new model instance',
                '19. Fresh worker receives comprehensive continuation briefing',
              ].map((step, idx) => (
                <div key={idx} className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80 flex items-start gap-2">
                  <span className="font-mono text-emerald-400 font-semibold">{idx + 1}.</span>
                  <span className="text-zinc-300">{step.slice(step.indexOf('.') + 2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: COLD RESUMPTION */}
        {activeTab === 'resume' && (
          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              Standardized Cold Worker Resume Briefing
            </h3>
            <p className="text-xs text-zinc-400">
              When a fresh AI model connects to the project, `project_resume` returns structured continuation context:
            </p>

            <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
{JSON.stringify(
  {
    projectId: "prj-eadd84dc",
    checkpointId: "chk-a926822d",
    gitCommitSha: "a8fde9b83769c3a3ad4c89fb98b3c95973795ba4",
    currentPhase: "V0_FOUNDATION",
    completedCapabilities: [
      "[VERIFIED] Implement CoreMath CLI Runner",
      "[VERIFIED] Task DAG Scheduler & Cycle Detection",
      "[VERIFIED] Dual Storage SQLite & .vibe Synchronization"
    ],
    readyTasks: [
      {
        id: "task-p5-completion-gate",
        title: "Phase 5: Completion Gate & Automatic Repair",
        priority: "CRITICAL",
        description: "Enforce contract verification prior to completion"
      }
    ],
    activeTasks: [],
    recentFailures: [],
    nextRecommendedAction: "Claim and execute task task-p5-completion-gate",
    instructionsForWorker: "You are an interchangeable intelligence worker operating within VIBE ENGINEERING MCP. MCP is your operating system. Check readyTasks, claim the highest priority task using task_claim, write files, run module harnesses, and call task_complete to verify."
  },
  null,
  2
)}
            </pre>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-900/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
        <div className="flex items-center gap-2">
          <span>Vibe Engineering MCP Control Plane</span>
          <span>•</span>
          <span className="font-mono">Node 22 · TypeScript · node:sqlite · Vitest</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Stdio Protocol: Connected</span>
          <span className="text-emerald-400">● Status: Healthy</span>
        </div>
      </footer>
    </div>
  );
}
