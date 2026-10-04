/**
 * Human-readable .vibe/ directory file store synchronizer
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { Project } from '../models/project.js';
import { Task } from '../models/task.js';
import { Module } from '../models/module.js';
import { Contract, ObservableEvidence } from '../models/contract.js';
import { Checkpoint } from '../models/checkpoint.js';
import { Logger } from '../utils/logger.js';

export class VibeFileStore {
  private vibeDir: string;
  private logger = new Logger('VibeFileStore');

  constructor(private projectRoot: string) {
    this.vibeDir = path.join(this.projectRoot, '.vibe');
  }

  ensureDirectories(): void {
    const subdirs = [
      this.vibeDir,
      path.join(this.vibeDir, 'decisions'),
      path.join(this.vibeDir, 'contracts'),
      path.join(this.vibeDir, 'checkpoints'),
      path.join(this.vibeDir, 'observations'),
      path.join(this.vibeDir, 'runs'),
    ];

    for (const dir of subdirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  syncProject(project: Project): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'project.yaml');
    fs.writeFileSync(filePath, YAML.stringify(project), 'utf8');
  }

  syncTasks(tasks: Task[]): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'tasks.yaml');
    fs.writeFileSync(filePath, YAML.stringify({ tasks }), 'utf8');
  }

  syncModules(modules: Module[]): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'modules.yaml');
    fs.writeFileSync(filePath, YAML.stringify({ modules }), 'utf8');
  }

  syncContracts(contracts: Contract[]): void {
    this.ensureDirectories();
    for (const c of contracts) {
      const filePath = path.join(this.vibeDir, 'contracts', `${c.id}.yaml`);
      fs.writeFileSync(filePath, YAML.stringify(c), 'utf8');
    }
  }

  syncCheckpoint(checkpoint: Checkpoint): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'checkpoints', `${checkpoint.id}.yaml`);
    fs.writeFileSync(filePath, YAML.stringify(checkpoint), 'utf8');
    // Also update current checkpoint pointer
    fs.writeFileSync(path.join(this.vibeDir, 'checkpoints', 'latest.yaml'), YAML.stringify(checkpoint), 'utf8');
  }

  recordObservation(evidence: ObservableEvidence): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'observations', `${evidence.id}.yaml`);
    fs.writeFileSync(filePath, YAML.stringify(evidence), 'utf8');
  }

  recordDecision(decisionId: string, title: string, context: string, choice: string, consequences: string[]): void {
    this.ensureDirectories();
    const filePath = path.join(this.vibeDir, 'decisions', `${decisionId}.yaml`);
    const doc = {
      id: decisionId,
      title,
      context,
      choice,
      consequences,
      recordedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, YAML.stringify(doc), 'utf8');
  }

  syncArchitecture(architecture: {
    systemDesign: string;
    modules: unknown[];
    interfaces: unknown[];
    dependencies: unknown[];
  }): void {
    this.ensureDirectories();
    fs.writeFileSync(path.join(this.vibeDir, 'architecture.yaml'), YAML.stringify(architecture), 'utf8');
    fs.writeFileSync(path.join(this.vibeDir, 'system-design.yaml'), YAML.stringify({ systemDesign: architecture.systemDesign }), 'utf8');
    fs.writeFileSync(path.join(this.vibeDir, 'interfaces.yaml'), YAML.stringify({ interfaces: architecture.interfaces }), 'utf8');
    fs.writeFileSync(path.join(this.vibeDir, 'dependencies.yaml'), YAML.stringify({ dependencies: architecture.dependencies }), 'utf8');
  }

  syncRequirements(requirements: {
    title: string;
    goals: string[];
    capabilities: Array<{ id: string; name: string; acceptanceCriteria: string[] }>;
  }): void {
    this.ensureDirectories();
    fs.writeFileSync(path.join(this.vibeDir, 'requirements.yaml'), YAML.stringify(requirements), 'utf8');
  }
}
