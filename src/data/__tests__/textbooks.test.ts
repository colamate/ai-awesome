import { describe, expect, it } from 'vitest';
import { buildPool, countPool, loadEnglishTextbook, EMPTY_FILTER } from '../textbooks';
import { generateEngSession } from '@/core/english/generate';
import type { EngPracticeConfig } from '@/core/english/types';

describe('loadEnglishTextbook', () => {
  it('loads the english node with grades 1-2', () => {
    const tb = loadEnglishTextbook();
    expect(tb.grades.map((g) => g.grade)).toEqual([1, 2]);
    expect(tb.textbook).toContain('英语');
  });
});

describe('real dataset', () => {
  const tb = loadEnglishTextbook();

  it('covers 24 units with non-empty words and sentences', () => {
    let units = 0;
    for (const g of tb.grades) {
      for (const v of g.volumes) {
        expect(v.units).toHaveLength(6);
        units += v.units.length;
        for (const u of v.units) {
          expect(u.words.length).toBeGreaterThan(0);
          expect(u.sentences.length).toBeGreaterThan(0);
        }
      }
    }
    expect(units).toBe(24);
  });

  it('contains the documented corpus size (≥24 units, >250 words, >300 sentences)', () => {
    const all = countPool(tb, EMPTY_FILTER);
    expect(all.words).toBeGreaterThanOrEqual(250);
    expect(all.sentences).toBeGreaterThanOrEqual(300);
  });

  it('produces a word-only pool for grade 1 volume 1', () => {
    const pool = buildPool(tb, { grades: [1], volumes: [1], units: [] });
    expect(pool.words.length).toBeGreaterThan(0);
    expect(pool.words.every((w) => w.grade === 1 && w.volume === 1)).toBe(true);
    expect(pool.sentences.length).toBeGreaterThan(0);
    expect(pool.sentences.every((s) => s.grade === 1 && s.volume === 1)).toBe(true);
  });

  it('filters units across multiple grades (AND across dimensions, OR within)', () => {
    const pool = buildPool(tb, { grades: [], volumes: [], units: [1] });
    expect(pool.words.every((w) => w.unit === 1)).toBe(true);
    expect(pool.unitTitles.size).toBe(4);
  });

  it('empty filter returns everything', () => {
    const pool = buildPool(tb, EMPTY_FILTER);
    expect(pool.words.length).toBeGreaterThanOrEqual(250);
    expect(pool.unitTitles.size).toBe(24);
  });

  it('passes ipa through when the enrichment script has run', () => {
    const pool = buildPool(tb, EMPTY_FILTER);
    const withIpa = pool.words.filter((w) => w.ipa !== undefined && w.ipa !== '');
    for (const w of withIpa) expect(w.ipa).toMatch(/^\/.+\/$/);
  });

  it('generates a real 10-word practice session from real data', () => {
    const pool = buildPool(tb, { grades: [1], volumes: [1], units: [] });
    const config: EngPracticeConfig = {
      kind: 'word',
      filter: { grades: [1], volumes: [1], units: [] },
      wordMode: 'en2zh',
      answerMode: 'choice4',
      questionCount: 10,
    };
    const qs = generateEngSession(config, pool, { random: Math.random });
    expect(qs).toHaveLength(10);
    for (const q of qs) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.answer);
    }
  });
});
