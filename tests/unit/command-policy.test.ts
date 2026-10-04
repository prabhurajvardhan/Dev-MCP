import { describe, it, expect } from 'vitest';
import { CommandPolicy } from '../../src/security/command-policy.js';

describe('CommandPolicy', () => {
  it('allows safe development commands', () => {
    const safeCommands = [
      'npm test',
      'npx vitest run',
      'git status',
      'node src/index.js',
      'echo "hello"',
      'cat package.json',
      'ls -la',
    ];

    for (const cmd of safeCommands) {
      const res = CommandPolicy.evaluate(cmd);
      expect(res.allowed).toBe(true);
    }
  });

  it('rejects destructive and malicious commands', () => {
    const dangerousCommands = [
      'rm -rf /',
      'rm -rf / --no-preserve-root',
      'sudo rm -rf node_modules',
      'mkfs.ext4 /dev/sda1',
      ':(){ :|:& };:',
      'chmod -R 777 /',
    ];

    for (const cmd of dangerousCommands) {
      const res = CommandPolicy.evaluate(cmd);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBeDefined();
    }
  });
});
