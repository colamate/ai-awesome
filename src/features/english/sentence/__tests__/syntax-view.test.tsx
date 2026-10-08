import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SyntaxView from '../SyntaxView';
import { getSyntax, type SyntaxToken } from '../syntaxData';

vi.mock('../syntaxData', () => ({ getSyntax: vi.fn() }));

const TOKENS: SyntaxToken[] = [
  { text: 'The', pos: 'DET', dep: 'det', head: 1 },
  { text: 'dog', pos: 'NOUN', dep: 'nsubj', head: 2 },
  { text: 'is', pos: 'AUX', dep: 'ROOT', head: 2 },
  { text: 'big', pos: 'ADJ', dep: 'acomp', head: 2 },
];

beforeEach(() => {
  vi.mocked(getSyntax).mockReset();
});

function roleText(container: HTMLElement, role: string): string | null {
  return container.querySelector(`[data-role="${role}"]`)?.textContent ?? null;
}

describe('SyntaxView 句法着色 (FR-ENG-13)', () => {
  it('有标注时按成分着色并渲染图例', () => {
    vi.mocked(getSyntax).mockReturnValue(TOKENS);
    const { container } = render(<SyntaxView sentence="The dog is big." />);

    expect(screen.getByTestId('syntax-view')).toBeInTheDocument();
    expect(roleText(container, 'subj')).toBe('dog');
    expect(roleText(container, 'pred')).toBe('is');
    expect(roleText(container, 'adj')).toBe('big');
    expect(roleText(container, 'other')).toBe('The');

    const legend = screen.getByTestId('syntax-legend');
    for (const label of ['主语', '谓语', '宾语', '状语', '定语', '形容词']) {
      expect(legend).toHaveTextContent(label);
    }
  });

  it('标点前不留空格', () => {
    vi.mocked(getSyntax).mockReturnValue([
      { text: 'Hi', pos: 'INTJ', dep: 'intj', head: 1 },
      { text: '!', pos: 'PUNCT', dep: 'punct', head: 0 },
    ]);
    render(<SyntaxView sentence="Hi!" />);
    expect(screen.getByTestId('syntax-view').textContent).toBe('Hi!');
  });

  it('无标注时降级为纯文本，不渲染图例', () => {
    vi.mocked(getSyntax).mockReturnValue(null);
    render(<SyntaxView sentence="The dog is big." />);
    expect(screen.getByTestId('syntax-plain')).toHaveTextContent('The dog is big.');
    expect(screen.queryByTestId('syntax-view')).toBeNull();
    expect(screen.queryByTestId('syntax-legend')).toBeNull();
  });

  it('空标注数组同样降级', () => {
    vi.mocked(getSyntax).mockReturnValue([]);
    render(<SyntaxView sentence="Hello." />);
    expect(screen.getByTestId('syntax-plain')).toHaveTextContent('Hello.');
    expect(screen.queryByTestId('syntax-legend')).toBeNull();
  });
});
