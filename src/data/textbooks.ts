import rawTextbook from '../../data/textbooks.json';
import type { EngFilter, EngPool, PoolSentence, PoolWord } from '@/core/english/types';

export interface TextbookWord {
  en: string;
  zh: string;
  unverified?: boolean;
  ipa?: string;
}

export interface TextbookSentence {
  en: string;
  zh: string;
  zhNote?: string;
  source?: string;
}

export interface TextbookUnit {
  unit: number;
  title: string;
  words: TextbookWord[];
  sentences: TextbookSentence[];
}

export interface TextbookVolume {
  volume: number;
  volume_name: string;
  units: TextbookUnit[];
}

export interface TextbookGrade {
  grade: number;
  volumes: TextbookVolume[];
}

export interface EnglishTextbook {
  textbook: string;
  grades: TextbookGrade[];
}

export function loadEnglishTextbook(): EnglishTextbook {
  const root = (rawTextbook as { english?: unknown }).english;
  if (!root) throw new Error('data/textbooks.json 缺少 english 节点');
  return root as EnglishTextbook;
}

const matches = (selected: number[], value: number): boolean =>
  selected.length === 0 || selected.includes(value);

export function buildPool(tb: EnglishTextbook, filter: EngFilter): EngPool {
  const words: PoolWord[] = [];
  const sentences: PoolSentence[] = [];
  const unitTitles = new Map<string, string>();

  for (const grade of tb.grades) {
    if (!matches(filter.grades, grade.grade)) continue;
    for (const vol of grade.volumes) {
      if (!matches(filter.volumes, vol.volume)) continue;
      for (const unit of vol.units) {
        if (!matches(filter.units, unit.unit)) continue;
        const unitKey = `${grade.grade}-${vol.volume}-${unit.unit}`;
        unitTitles.set(unitKey, unit.title);
        for (const w of unit.words) {
          words.push({
            en: w.en,
            zh: w.zh,
            ...(w.unverified !== undefined ? { unverified: w.unverified } : {}),
            ...(w.ipa !== undefined ? { ipa: w.ipa } : {}),
            grade: grade.grade,
            volume: vol.volume,
            unit: unit.unit,
            unitTitle: unit.title,
          });
        }
        for (const s of unit.sentences) {
          sentences.push({
            en: s.en,
            zh: s.zh,
            ...(s.zhNote !== undefined ? { zhNote: s.zhNote } : {}),
            ...(s.source !== undefined ? { source: s.source } : {}),
            grade: grade.grade,
            volume: vol.volume,
            unit: unit.unit,
            unitTitle: unit.title,
          });
        }
      }
    }
  }
  return { words, sentences, unitTitles };
}

export function countPool(tb: EnglishTextbook, filter: EngFilter): { words: number; sentences: number } {
  const pool = buildPool(tb, filter);
  return { words: pool.words.length, sentences: pool.sentences.length };
}

export const EMPTY_FILTER: EngFilter = { grades: [], volumes: [], units: [] };
