import type { EngQuestion } from './types';

/** 英文归一化：全角→半角、压缩空白、小写、弯引号→直引号、去首尾标点 (Q-ENG-05) */
export function normalizeEn(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[‘’“”]/g, (ch) => (ch === '‘' || ch === '’' ? "'" : '"'))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^[.,!?;:'"]+|[.,!?;:'"]+$/g, '')
    .trim();
}

/** 中文归一化：去空白、去中英文标点 */
export function normalizeZh(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：""''《》〈〉（）().,!?;:'"~·…—-]/g, '')
    .trim();
}

const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/;

/** 答案是否为中文内容（含 CJK 即走中文判题路径） */
export function isZhAnswer(answer: string): boolean {
  return CJK_RE.test(answer);
}

/**
 * 判题 (FR-ENG-02/03/11)：
 * - 答案为英文：normalizeEn 全等（大小写、标点、空白归一）
 * - 答案为中文：normalizeZh 全等，或与答案按 ，,、；/ 分段之一全等 (D7)
 */
export function judgeEng(q: EngQuestion, input: string): boolean {
  if (isZhAnswer(q.answer)) {
    const got = normalizeZh(input);
    if (got === '') return false;
    if (got === normalizeZh(q.answer)) return true;
    return q.answer
      .split(/[，,、；/]/)
      .map((seg) => normalizeZh(seg))
      .filter((seg) => seg !== '')
      .includes(got);
  }
  const got = normalizeEn(input);
  if (got === '') return false;
  return got === normalizeEn(q.answer);
}
