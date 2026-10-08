import { describe, expect, it } from 'vitest';
import { generateEngSession, questionCountFor } from '../generate';
import { EngConfigError } from '../types';
import type { EngPracticeConfig, EngPool, EngQuestion } from '../types';

function makePool(): EngPool {
  const words = [
    { en: 'cat', zh: '猫', ipa: '/kæt/', grade: 1, volume: 1, unit: 1, unitTitle: 'Animals' },
    { en: 'dog', zh: '狗', grade: 1, volume: 1, unit: 1, unitTitle: 'Animals' },
    { en: 'apple', zh: '苹果', grade: 1, volume: 1, unit: 2, unitTitle: 'Food' },
    { en: 'book', zh: '书', grade: 1, volume: 1, unit: 2, unitTitle: 'Food' },
    { en: 'pen', zh: '钢笔', grade: 1, volume: 2, unit: 3, unitTitle: 'School' },
  ];
  const sentences = [
    { en: 'Hello!', zh: '你好！', grade: 1, volume: 1, unit: 1, unitTitle: 'Greet' },
    { en: 'Good morning.', zh: '早上好。', grade: 1, volume: 1, unit: 1, unitTitle: 'Greet' },
    { en: 'I love my family.', zh: '我爱我的家。', zhNote: '家人', grade: 1, volume: 1, unit: 2, unitTitle: 'Family' },
    { en: 'How are you?', zh: '你好吗？', grade: 1, volume: 1, unit: 2, unitTitle: 'Family' },
  ];
  return { words, sentences, unitTitles: new Map() };
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const baseWordConfig: EngPracticeConfig = {
  kind: 'word',
  filter: { grades: [1], volumes: [1], units: [] },
  wordMode: 'en2zh',
  answerMode: 'input',
  questionCount: 10,
};

describe('questionCountFor', () => {
  it('returns the pool size when the pool is smaller than the selection', () => {
    expect(questionCountFor(10, 4)).toBe(4);
    expect(questionCountFor(20, 10)).toBe(10);
    expect(questionCountFor(50, 302)).toBe(50);
  });

  it('throws when the selection is not 10/20/50', () => {
    expect(() => questionCountFor(7 as never, 10)).toThrow(EngConfigError);
  });
});

describe('generateEngSession validation', () => {
  it('throws EngConfigError when the pool is empty', () => {
    const empty: EngPool = { words: [], sentences: [], unitTitles: new Map() };
    expect(() => generateEngSession(baseWordConfig, empty)).toThrow(EngConfigError);
  });

  it('throws when choice4 is selected with fewer than 4 items', () => {
    const pool = makePool();
    pool.words = pool.words.slice(0, 3);
    expect(() => generateEngSession({ ...baseWordConfig, answerMode: 'choice4' }, pool)).toThrow(
      EngConfigError,
    );
  });

  it('throws when dictation is combined with choice4', () => {
    const config: EngPracticeConfig = { ...baseWordConfig, wordMode: 'dictation', answerMode: 'choice4' };
    expect(() => generateEngSession(config, makePool())).toThrow(EngConfigError);
  });

  it('throws when wordMode is missing', () => {
    const config: EngPracticeConfig = { ...baseWordConfig, wordMode: undefined };
    expect(() => generateEngSession(config, makePool())).toThrow(EngConfigError);
  });
});

describe('word mode wiring', () => {
  it('en2zh: display is English, answer is Chinese', () => {
    const qs = generateEngSession(baseWordConfig, makePool(), { random: lcg(1) });
    for (const q of qs) {
      expect(q.kind).toBe('word');
      expect(q.display).not.toBe('');
      expect(q.display).toBe(q.answerDisplay.en);
      expect(q.answer).toBe(q.answerDisplay.zh);
      expect(q.ttsText).toBeUndefined();
    }
  });

  it('zh2en: display is Chinese, answer is English', () => {
    const qs = generateEngSession(
      { ...baseWordConfig, wordMode: 'zh2en' },
      makePool(),
      { random: lcg(2) },
    );
    for (const q of qs) {
      expect(q.display).toBe(q.answerDisplay.zh);
      expect(q.answer).toBe(q.answerDisplay.en);
    }
  });

  it('dictation: display is empty, ttsText carries the English word', () => {
    const qs = generateEngSession(
      { ...baseWordConfig, wordMode: 'dictation', questionCount: 10 },
      makePool(),
      { random: lcg(3) },
    );
    for (const q of qs) {
      expect(q.display).toBe('');
      expect(q.ttsText).toBe(q.answer);
    }
    const cat = qs.find((q) => q.answer === 'cat');
    expect(cat?.answerDisplay.ipa).toBe('/kæt/');
  });

  it('ipa is passed through when present', () => {
    const qs = generateEngSession(baseWordConfig, makePool(), { random: lcg(4) });
    const cat = qs.find((q) => q.answerDisplay.en === 'cat');
    expect(cat?.answerDisplay.ipa).toBe('/kæt/');
  });
});

describe('choice4 generation', () => {
  it('produces exactly 4 distinct choices including the answer, same direction', () => {
    const qs = generateEngSession(
      { ...baseWordConfig, answerMode: 'choice4' },
      makePool(),
      { random: lcg(5) },
    );
    for (const q of qs) {
      expect(q.choices).toBeDefined();
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(q.answer);
      for (const c of q.choices ?? []) expect(typeof c).toBe('string');
    }
  });

  it('zh2en choice4 offers English options', () => {
    const qs = generateEngSession(
      { ...baseWordConfig, wordMode: 'zh2en', answerMode: 'choice4' },
      makePool(),
      { random: lcg(6) },
    );
    const enSet = new Set(makePool().words.map((w) => w.en));
    for (const q of qs) {
      for (const c of q.choices ?? []) expect(enSet.has(c)).toBe(true);
    }
  });

  it('throws when answerMode is handwriting for sentences', () => {
    const config: EngPracticeConfig = {
      kind: 'sentence',
      filter: { grades: [], volumes: [], units: [] },
      sentenceMode: 'en2zh',
      answerMode: 'handwriting' as never,
      questionCount: 10,
    };
    expect(() => generateEngSession(config, makePool())).toThrow(EngConfigError);
  });
});

describe('sentence modes', () => {
  const sentenceConfig: EngPracticeConfig = {
    kind: 'sentence',
    filter: { grades: [], volumes: [], units: [] },
    sentenceMode: 'en2zh',
    answerMode: 'input',
    questionCount: 10,
  };

  it('en2zh wires display=en answer=zh and carries syntaxKey', () => {
    const qs = generateEngSession(sentenceConfig, makePool(), { random: lcg(7) });
    for (const q of qs) {
      expect(q.kind).toBe('sentence');
      expect(q.answer).toBe(q.answerDisplay.zh);
      expect(q.syntaxKey).toBe(q.answerDisplay.en);
    }
  });

  it('readAlong has no choices, no syntaxKey, ttsText set', () => {
    const qs = generateEngSession(
      { ...sentenceConfig, sentenceMode: 'readAlong', answerMode: 'choice4' },
      makePool(),
      { random: lcg(8) },
    );
    for (const q of qs) {
      expect(q.choices).toBeUndefined();
      expect(q.syntaxKey).toBeUndefined();
      expect(q.ttsText).toBe(q.answer);
    }
  });

  it('zhNote flows into answerDisplay', () => {
    const qs = generateEngSession(sentenceConfig, makePool(), { random: lcg(9) });
    const family = qs.find((q) => q.answerDisplay.en === 'I love my family.');
    expect(family?.answerDisplay.zhNote).toBe('家人');
  });
});

describe('dedupe and seen prioritization', () => {
  it('fingerprints are unique within one session', () => {
    const qs = generateEngSession(baseWordConfig, makePool(), { random: lcg(10) });
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.fingerprint)).size).toBe(5);
  });

  it('fingerprints are stable across sessions with identical input', () => {
    const a = generateEngSession(baseWordConfig, makePool(), { random: lcg(11) });
    const b = generateEngSession(baseWordConfig, makePool(), { random: lcg(11) });
    expect(a.map((q) => q.fingerprint)).toEqual(b.map((q) => q.fingerprint));
  });

  it('places unseen questions before seen ones', () => {
    const first = generateEngSession(baseWordConfig, makePool(), { random: lcg(12) });
    const seen = first.slice(0, 3).map((q) => q.fingerprint);
    const next = generateEngSession(baseWordConfig, makePool(), {
      random: lcg(13),
      seenFingerprints: seen,
    });
    const unseenFps = new Set(
      generateEngSession(baseWordConfig, makePool(), { random: lcg(14) }).map((q) => q.fingerprint),
    );
    const firstNext = next[0];
    expect(firstNext).toBeDefined();
    if (firstNext && seen.includes(firstNext.fingerprint)) {
      expect(next.every((q) => seen.includes(q.fingerprint))).toBe(true);
    } else {
      expect(unseenFps.size).toBeGreaterThan(0);
    }
  });

  it('still returns the full requested count when all questions were seen', () => {
    const all = generateEngSession(baseWordConfig, makePool(), { random: lcg(15) });
    const fps = all.map((q: EngQuestion) => q.fingerprint);
    const again = generateEngSession(baseWordConfig, makePool(), {
      random: lcg(16),
      seenFingerprints: fps,
    });
    expect(again).toHaveLength(5);
  });
});
