import { describe, it, expect } from 'bun:test';
import { containsChinese, getChineseCharCount } from '../src/pinyin.js';

describe('containsChinese', () => {
  it('detects Chinese characters', () => {
    expect(containsChinese('你好世界')).toBe(true);
    expect(containsChinese('中文')).toBe(true);
    expect(containsChinese('hello')).toBe(false);
    expect(containsChinese('hello 你好')).toBe(true);
    expect(containsChinese('123!@#')).toBe(false);
    expect(containsChinese('')).toBe(false);
  });
});

describe('getChineseCharCount', () => {
  it('counts Chinese characters correctly', () => {
    expect(getChineseCharCount('你好世界')).toBe(4);
    expect(getChineseCharCount('hello 你好')).toBe(2);
    expect(getChineseCharCount('hello world')).toBe(0);
    expect(getChineseCharCount('')).toBe(0);
    expect(getChineseCharCount('123!@#')).toBe(0);
    expect(getChineseCharCount('你好，世界！')).toBe(4);
  });
});
