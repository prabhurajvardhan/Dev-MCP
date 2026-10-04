/**
 * Path Policy: strictly enforces workspace containment and prevents path traversal
 */
import path from 'node:path';
import fs from 'node:fs';

export class PathPolicy {
  constructor(private projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Resolves and verifies that the target path is inside the projectRoot or workspace
   */
  resolveSafePath(targetPath: string, workspaceRoot?: string): string {
    const base = workspaceRoot ? path.resolve(workspaceRoot) : this.projectRoot;
    
    // Prevent resolving outside base
    const resolved = path.resolve(base, targetPath);
    const normalizedBase = path.normalize(base);
    const normalizedTarget = path.normalize(resolved);

    // Verify target starts with base
    if (!normalizedTarget.startsWith(normalizedBase)) {
      throw new Error(`Path traversal denied: '${targetPath}' resolves outside workspace root '${base}'`);
    }

    // Check for symlinks pointing outside base if file exists
    try {
      if (fs.existsSync(normalizedTarget)) {
        const real = fs.realpathSync(normalizedTarget);
        if (!real.startsWith(normalizedBase)) {
          throw new Error(`Symlink traversal denied: '${targetPath}' resolves outside workspace root`);
        }
      }
    } catch {
      // If path does not exist yet (e.g. creating new file), check parent
      const parent = path.dirname(normalizedTarget);
      if (fs.existsSync(parent)) {
        const realParent = fs.realpathSync(parent);
        if (!realParent.startsWith(normalizedBase)) {
          throw new Error(`Symlink parent traversal denied: '${targetPath}' points outside workspace root`);
        }
      }
    }

    return normalizedTarget;
  }

  /**
   * Validates if a path is safe without throwing
   */
  isSafePath(targetPath: string, workspaceRoot?: string): boolean {
    try {
      this.resolveSafePath(targetPath, workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }
}
