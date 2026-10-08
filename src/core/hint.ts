import type { OperationType } from './types';

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function cnNum(n: number): string {
  if (n < 10) return CN_DIGITS[n] ?? String(n);
  if (n < 20) return `十${n === 10 ? '' : CN_DIGITS[n - 10] ?? ''}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${CN_DIGITS[tens] ?? tens}十${ones === 0 ? '' : CN_DIGITS[ones] ?? ones}`;
}

/**
 * 算术题解题思路 (FR-MATH-10) — 题型模板 + 动态代入 (Q-05 默认值)。
 * 每条思路均给出可验证的正确推导。
 */
export function arithmeticHint(type: OperationType, a: number, b: number, answer: number): string {
  switch (type) {
    case 'add': {
      const tens = Math.floor(b / 10) * 10;
      const ones = b % 10;
      if (tens === 0) {
        return `从 ${a} 开始，往后数 ${b} 个数，数到 ${answer}。所以 ${a} + ${b} = ${answer}。`;
      }
      if (ones === 0) {
        return `先把整十数相加：${a} + ${tens} = ${a + tens}，所以 ${a} + ${b} = ${answer}。`;
      }
      return `把 ${b} 拆成 ${tens} + ${ones}：先算 ${a} + ${tens} = ${a + tens}，再算 ${a + tens} + ${ones} = ${answer}。`;
    }
    case 'sub':
      return `想加算减：因为 ${answer} + ${b} = ${a}，所以 ${a} - ${b} = ${answer}。`;
    case 'mul': {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const product = lo * hi;
      const sentence = `${cnNum(lo)}${cnNum(hi)}${cnNum(product)}`;
      return `乘法口诀：${sentence}，所以 ${a} × ${b} = ${product}。`;
    }
    case 'div':
      return `想乘算除：因为 ${answer} × ${b} = ${a}，所以 ${a} ÷ ${b} = ${answer}。`;
    default:
      return `${a} 与 ${b} 的换算结果是 ${answer}。`;
  }
}
