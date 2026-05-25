import { describe, it, expect } from 'bun:test';
import { getCategories, getRandomArticle, getCategoryLabel } from '../src/articles.js';

describe('getCategories', () => {
  it('returns three categories', () => {
    const cats = getCategories();
    expect(cats).toHaveLength(3);
    expect(cats.map((c) => c.id)).toEqual(['jokes', 'stories', 'idioms']);
    expect(cats.map((c) => c.label)).toEqual(['笑话', '小故事', '成语故事']);
  });
});

describe('getCategoryLabel', () => {
  it('returns correct labels', () => {
    expect(getCategoryLabel('jokes')).toBe('笑话');
    expect(getCategoryLabel('stories')).toBe('小故事');
    expect(getCategoryLabel('idioms')).toBe('成语故事');
  });

  it('returns empty string for unknown category', () => {
    expect(getCategoryLabel('unknown')).toBe('');
  });
});

describe('getRandomArticle', () => {
  it('returns an article from the category', () => {
    const article = getRandomArticle('jokes');
    expect(article).not.toBeNull();
    expect(article).toHaveProperty('id');
    expect(article).toHaveProperty('title');
    expect(article).toHaveProperty('content');
    expect(article).toHaveProperty('wordCount');
  });

  it('returns null for unknown category', () => {
    expect(getRandomArticle('unknown')).toBeNull();
  });

  it('respects wordCount filter', () => {
    const article = getRandomArticle('jokes', 50);
    if (article) {
      // Some jokes have more than 50 words, some less
      // At least verify the filter logic is applied
      expect(article.wordCount).toBeLessThanOrEqual(50);
    }
  });

  it('returns null when no articles match wordCount filter', () => {
    const article = getRandomArticle('jokes', 1);
    expect(article).toBeNull();
  });

  it('adapts to very generous word limit', () => {
    const article = getRandomArticle('jokes', 9999);
    expect(article).not.toBeNull();
  });
});
