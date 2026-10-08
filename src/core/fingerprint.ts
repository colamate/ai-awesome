import type { OperationType } from './types';

/** 稳定去重键：题型 + 规范化题面（去空白）(FR-MATH-14) */
export function fingerprint(type: OperationType, display: string): string {
  return `${type}:${display.replace(/\s+/g, '')}`;
}
