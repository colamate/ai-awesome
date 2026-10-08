import type { Question } from './types';

/** 全角数字/符号归一为半角，去除空白 */
function normalize(input: string): string {
  return input
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[－—–]/g, '-')
    .replace(/\s+/g, '');
}

/**
 * 判题 (FR-MATH-09)。
 * input 模式：接受字符串（归一化后按数值比较，容忍首尾空白与等价写法）。
 * choice4 模式：接受选项数值。
 */
export function judge(question: Question, input: string | number): boolean {
  if (typeof input === 'number') {
    return input === question.answer;
  }
  const raw = normalize(input);
  if (raw === '') return false;
  const value = Number(raw);
  if (Number.isNaN(value)) return false;
  return value === question.answer;
}
