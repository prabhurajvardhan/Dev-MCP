/**
 * Deterministic and readable ID generators
 */
import crypto from 'node:crypto';

export function generateId(prefix: string): string {
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${randomSuffix}`;
}

export function generateTimestamp(): string {
  return new Date().toISOString();
}
