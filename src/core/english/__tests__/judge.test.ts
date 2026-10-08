import { describe, expect, it } from 'vitest';
import { isZhAnswer, judgeEng, normalizeEn, normalizeZh } from '../judge';
import type { EngQuestion } from '../types';

function wordQ(answer: string): EngQuestion {
  return {
    fingerprint: `fp:${answer}`,
    kind: 'word',
    display: '',
    answer,
    answerDisplay: { en: 'x', zh: answer },
    hint: '',
  };
}

describe('normalizeEn', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeEn('  Hello   World  ')).toBe('hello world');
  });

  it('converts full-width characters to half-width', () => {
    expect(normalizeEn('ＣＡＴ')).toBe('cat');
  });

  it('converts curly quotes to straight quotes', () => {
    expect(normalizeEn('let’s')).toBe("let's");
  });

  it('strips leading/trailing punctuation', () => {
    expect(normalizeEn('cat.')).toBe('cat');
    expect(normalizeEn('"apple"')).toBe('apple');
  });
});

describe('normalizeZh', () => {
  it('removes whitespace and punctuation', () => {
    expect(normalizeZh(' 你 好 。 ')).toBe('你好');
    expect(normalizeZh('苹果，桃。')).toBe('苹果桃');
  });
});

describe('isZhAnswer', () => {
  it('detects CJK content', () => {
    expect(isZhAnswer('你好')).toBe(true);
    expect(isZhAnswer('cat')).toBe(false);
  });
});

describe('judgeEng', () => {
  it('accepts case-insensitive English answers', () => {
    expect(judgeEng(wordQ('Apple'), 'APPLE')).toBe(true);
    expect(judgeEng(wordQ('apple'), ' apple ')).toBe(true);
  });

  it('rejects wrong English answers', () => {
    expect(judgeEng(wordQ('apple'), 'orange')).toBe(false);
    expect(judgeEng(wordQ('apple'), '')).toBe(false);
  });

  it('tolerates punctuation and spacing differences in English', () => {
    expect(judgeEng(wordQ('Good morning'), 'good morning.')).toBe(true);
    expect(judgeEng(wordQ('let’s go'), "let's go")).toBe(true);
  });

  it('accepts exact Chinese answers ignoring punctuation', () => {
    expect(judgeEng(wordQ('你好'), '你好。')).toBe(true);
    expect(judgeEng(wordQ('苹果'), ' 苹果 ')).toBe(true);
  });

  it('accepts any segment of a multi-part Chinese answer', () => {
    expect(judgeEng(wordQ('喂，你好'), '你好')).toBe(true);
    expect(judgeEng(wordQ('喂，你好'), '喂')).toBe(true);
    expect(judgeEng(wordQ('喂，你好'), '不好')).toBe(false);
  });

  it('rejects empty Chinese input', () => {
    expect(judgeEng(wordQ('你好'), '。，')).toBe(false);
  });
});
