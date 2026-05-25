import { pinyin } from 'pinyin-pro';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function convertToPinyinHTML(text, { showPinyin = true } = {}) {
  if (!text) return '';

  const pinyinArray = pinyin(text, {
    type: 'array',
    toneType: 'symbol',
    multiple: false,
  });

  const characters = [...text];
  let result = [];

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (char === '\r') continue;
    if (char === '\n') {
      result.push('<br>');
      continue;
    }

    const py = pinyinArray[i] || '';
    const isChinese = py && py !== char;

    if (isChinese && showPinyin) {
      result.push(`<ruby>${escapeHtml(char)}<rt>${escapeHtml(py)}</rt></ruby>`);
    } else {
      result.push(escapeHtml(char));
    }
  }

  return result.join('');
}

export function containsChinese(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

export function getChineseCharCount(text) {
  const matches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return matches ? matches.length : 0;
}

