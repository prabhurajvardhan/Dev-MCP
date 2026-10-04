/**
 * Observable Evidence Collector
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ObservableEvidence, ObservableEvidenceSchema } from '../models/contract.js';
import { ObservableType } from '../models/module.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { VibeFileStore } from '../storage/vibe-file-store.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface ObservationInput {
  taskId?: string;
  moduleId?: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  evidenceType?: ObservableType;
  artifactPaths?: string[];
  metadata?: Record<string, unknown>;
}

export class ObservableEvidenceCollector {
  private logger = new Logger('ObservableEvidenceCollector');

  constructor(
    private stateStore?: SQLiteStateStore,
    private vibeFileStore?: VibeFileStore
  ) {}

  collect(input: ObservationInput): ObservableEvidence {
    const evidenceId = generateId('evd');
    const capturedArtifacts: string[] = [];

    // Calculate checksums of artifacts if provided
    if (input.artifactPaths) {
      for (const p of input.artifactPaths) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          capturedArtifacts.push(`${path.basename(p)}:sha256:${hash}`);
        }
      }
    }

    const evidence: ObservableEvidence = ObservableEvidenceSchema.parse({
      id: evidenceId,
      taskId: input.taskId,
      moduleId: input.moduleId,
      command: input.command,
      exitCode: input.exitCode,
      stdout: input.stdout,
      stderr: input.stderr,
      executionTimeMs: input.executionTimeMs,
      evidenceType: input.evidenceType || 'CLI',
      capturedArtifacts,
      capturedAt: generateTimestamp(),
      metadata: input.metadata || {},
    });

    if (this.stateStore) {
      this.stateStore.saveEvidence(evidence);
    }
    if (this.vibeFileStore) {
      this.vibeFileStore.recordObservation(evidence);
    }

    this.logger.debug(`Collected observable evidence ${evidenceId} for command: ${input.command}`);
    return evidence;
  }
}
