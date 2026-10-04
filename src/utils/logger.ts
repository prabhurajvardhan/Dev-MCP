/**
 * Structured logger for Vibe MCP server
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  constructor(private context: string = 'VibeMCP') {}

  private format(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: unknown) {
    if (process.env.DEBUG || process.env.VIBE_DEBUG) {
      console.error(this.format('DEBUG', message, meta));
    }
  }

  info(message: string, meta?: unknown) {
    console.error(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: unknown) {
    console.error(this.format('WARN', message, meta));
  }

  error(message: string, meta?: unknown) {
    console.error(this.format('ERROR', message, meta));
  }
}
