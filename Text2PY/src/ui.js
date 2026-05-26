import { convertToPinyinHTML } from './pinyin.js';
import { getCategories, getRandomArticle, getCategoryLabel } from './articles.js';

export function initUI() {
  const textInput = document.getElementById('text-input');
  const outputArea = document.getElementById('output-area');
  const toggleBtn = document.getElementById('toggle-pinyin');
  const printBtn = document.getElementById('print-view');
  const loadArticleBtn = document.getElementById('load-article');
  const categorySelect = document.getElementById('category-select');
  const wordCountSelect = document.getElementById('wordcount-select');
  const statusBar = document.getElementById('status-bar');

  let showPinyin = true;

  function render() {
    const text = textInput.value;
    if (!text) {
      outputArea.innerHTML = '<div class="placeholder">请输入中文文章开始阅读...</div>';
      return;
    }
    outputArea.innerHTML = convertToPinyinHTML(text, { showPinyin });
  }

  function updateStatus(text) {
    const charCount = [...text].filter(
      (c) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c)
    ).length;
    statusBar.textContent = `中文字数：${charCount}`;
  }

  textInput.addEventListener('input', () => {
    render();
    updateStatus(textInput.value);
  });

  toggleBtn.addEventListener('click', () => {
    showPinyin = !showPinyin;
    toggleBtn.classList.toggle('active', showPinyin);
    toggleBtn.textContent = showPinyin ? '隐藏拼音' : '显示拼音';
    render();
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  // Display settings
  const textColorInput = document.getElementById('text-color');
  const pinyinColorInput = document.getElementById('pinyin-color');
  const textSizeInput = document.getElementById('text-size');
  const pinyinSizeInput = document.getElementById('pinyin-size');
  const textSizeValue = document.getElementById('text-size-value');
  const pinyinSizeValue = document.getElementById('pinyin-size-value');
  const root = document.documentElement;

  textColorInput.addEventListener('input', () => {
    root.style.setProperty('--text-color', textColorInput.value);
  });

  pinyinColorInput.addEventListener('input', () => {
    root.style.setProperty('--pinyin-color', pinyinColorInput.value);
  });

  textSizeInput.addEventListener('input', () => {
    root.style.setProperty('--text-font-size', textSizeInput.value + 'px');
    textSizeValue.textContent = textSizeInput.value;
  });

  pinyinSizeInput.addEventListener('input', () => {
    root.style.setProperty('--pinyin-font-size', pinyinSizeInput.value + 'px');
    pinyinSizeValue.textContent = pinyinSizeInput.value;
  });

  const letterSpacingInput = document.getElementById('letter-spacing');
  const letterSpacingValue = document.getElementById('letter-spacing-value');
  letterSpacingInput.addEventListener('input', () => {
    root.style.setProperty('--text-letter-spacing', letterSpacingInput.value + 'em');
    letterSpacingValue.textContent = letterSpacingInput.value;
  });

  const categories = getCategories();
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.label;
    categorySelect.appendChild(option);
  });

  loadArticleBtn.addEventListener('click', () => {
    const categoryId = categorySelect.value;
    const maxWords = parseInt(wordCountSelect.value, 10);
    const article = getRandomArticle(categoryId, maxWords);

    if (!article) {
      const catLabel = getCategoryLabel(categoryId);
      outputArea.innerHTML = `<div class="placeholder">没有找到符合条件的${catLabel}，请尝试放宽字数限制</div>`;
      return;
    }

    textInput.value = article.content;
    updateStatus(article.content);
    render();
  });

  updateStatus('');
  render();
}
