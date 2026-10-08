import { describe, expect, it } from 'vitest';
import { analyzeTimes, formatMs } from '../timeAnalysis';
import type { AnswerRecord } from '@/data/repo';

const answer = (fingerprint: string, elapsedMs: number, correct = true): AnswerRecord => ({
  fingerprint,
  display: `${fingerprint} = ?`,
  type: 'add',
  userAnswer: '1',
  correct,
  elapsedMs,
});

describe('analyzeTimes (FR-MATH-12 / Q-06)', () => {
  it('计算总耗时与平均耗时', () => {
    const result = analyzeTimes([answer('a', 3000), answer('b', 1000), answer('c', 2000)]);
    expect(result.totalMs).toBe(6000);
    expect(result.avgMs).toBe(2000);
    expect(result.perQuestion).toHaveLength(3);
  });
  it('找出最慢与最快题', () => {
    const result = analyzeTimes([answer('a', 3000), answer('b', 1000), answer('c', 2000)]);
    expect(result.slowest?.fingerprint).toBe('a');
    expect(result.fastest?.fingerprint).toBe('b');
  });
  it('保持原始顺序', () => {
    const result = analyzeTimes([answer('a', 3000), answer('b', 1000)]);
    expect(result.perQuestion.map((q) => q.fingerprint)).toEqual(['a', 'b']);
  });
  it('空输入返回零值', () => {
    const result = analyzeTimes([]);
    expect(result).toEqual({ totalMs: 0, avgMs: 0, slowest: null, fastest: null, perQuestion: [] });
  });
});

describe('formatMs', () => {
  it('秒级', () => {
    expect(formatMs(45000)).toBe('45 秒');
  });
  it('分钟级补零', () => {
    expect(formatMs(125000)).toBe('2 分 05 秒');
  });
});
