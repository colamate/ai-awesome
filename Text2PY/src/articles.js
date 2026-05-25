import jokes from '../data/jokes.json';
import stories from '../data/stories.json';
import idioms from '../data/idioms.json';

const CATEGORIES = {
  jokes: { label: '笑话', data: jokes },
  stories: { label: '小故事', data: stories },
  idioms: { label: '成语故事', data: idioms },
};

export const categoryList = Object.entries(CATEGORIES).map(([key, { label }]) => ({
  id: key,
  label,
}));

export function getCategories() {
  return categoryList;
}

export function getRandomArticle(categoryId, maxWords = 9999) {
  const category = CATEGORIES[categoryId];
  if (!category) return null;

  const filtered = category.data.filter(
    (article) => article.wordCount <= maxWords
  );

  if (filtered.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

export function getArticlesByCategory(categoryId) {
  const category = CATEGORIES[categoryId];
  return category ? [...category.data] : [];
}

export function getCategoryLabel(categoryId) {
  const category = CATEGORIES[categoryId];
  return category ? category.label : '';
}
