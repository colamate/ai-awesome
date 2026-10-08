import raw from '../../../../data/syntax-en.json';

export interface SyntaxToken {
  text: string;
  pos: string;
  dep: string;
  head: number;
}

interface SyntaxMap {
  _skipped?: boolean;
  [key: string]: unknown;
}

const map = raw as unknown as SyntaxMap;

export function getSyntax(sentence: string): SyntaxToken[] | null {
  if (map._skipped === true) return null;
  const entry = map[sentence];
  if (entry === undefined || typeof entry !== 'object' || entry === null) return null;
  const tokens = (entry as { tokens?: unknown }).tokens;
  if (!Array.isArray(tokens)) return null;
  return tokens as SyntaxToken[];
}
