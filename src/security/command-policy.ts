/**
 * Command Policy: validates commands before execution to prevent malicious or unsafe terminal commands
 */

export interface CommandEvaluation {
  allowed: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export class CommandPolicy {
  // Explicitly banned command patterns
  private static DANGEROUS_PATTERNS = [
    /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?[a-zA-Z]*\s+(\/|\.\.)(\s|$)/, // rm -rf / or rm -r / or rm -rf ..
    /\brm\s+.*--no-preserve-root/,
    /\bmkfs/,                                                   // disk formatting
    /\bdd\s+if=.*of=\/dev/,                                     // disk overwrite
    /: *\(\) *{\s*: *\| *: *& *\s*;?\s*}\s*;\s*:/,            // fork bomb :(){ :|:& };:
    /\b: *\(\) *{/,                                             // function definition attempting fork bomb
    /\bshutdown\b/,
    /\breboot\b/,
    /\bchmod\s+.*777\s+\//,                                     // chmod 777 /
    />\s*\/etc\//,                                              // overwriting /etc
    />\s*\/dev\/sd/,
  ];

  // Whitelisted build/test commands or safe developer tools
  private static SAFE_PREFIXES = [
    'npm', 'npx', 'node', 'tsx', 'vitest', 'git', 'cat', 'ls', 'echo',
    'mkdir', 'touch', 'cp', 'mv', 'rm', 'grep', 'find', 'sed', 'awk',
    'which', 'pwd', 'head', 'tail', 'wc', 'curl', 'wget', 'python', 'python3',
    'pip', 'pytest', 'cargo', 'go', 'make', 'sh', 'bash'
  ];

  /**
   * Evaluates if a command string is permissible
   */
  static evaluate(command: string): CommandEvaluation {
    const trimmed = command.trim();
    if (!trimmed) {
      return { allowed: false, reason: 'Empty command string' };
    }

    // Check for dangerous shell tokens
    for (const pattern of CommandPolicy.DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: `Command matches dangerous pattern: ${pattern.toString()}`,
        };
      }
    }

    // Prevent sudo execution
    if (/^\s*sudo\b/.test(trimmed) || /;\s*sudo\b/.test(trimmed) || /\|\s*sudo\b/.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Sudo commands are forbidden inside autonomous workspace',
      };
    }

    return {
      allowed: true,
      sanitizedCommand: trimmed,
    };
  }
}
