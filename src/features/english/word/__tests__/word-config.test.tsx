import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import WordEntryScreen from '@/features/english/word/WordEntryScreen';

vi.mock('@/data/textbooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/textbooks')>();
  const { fixtureTb } = await import('./word-fixture');
  return { ...actual, loadEnglishTextbook: () => fixtureTb };
});

beforeEach(() => {
  localStorage.clear();
});

function renderWord() {
  return render(<WordEntryScreen onExit={vi.fn()} />);
}

function clickChip(testid: string, name: string) {
  fireEvent.click(within(screen.getByTestId(testid)).getByRole('button', { name }));
}

describe('单词配置页题池 (FR-ENG-05)', () => {
  it('默认展示全部 15 词并可开始', () => {
    renderWord();
    expect(screen.getByTestId('english-word')).toBeInTheDocument();
    expect(screen.getByTestId('config')).toBeInTheDocument();
    expect(screen.getByTestId('pool-count')).toHaveTextContent('题池 15 词');
    expect(screen.getByTestId('start')).toBeEnabled();
  });

  it('筛选为空时禁用开始并提示', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('units', '第 6 单元');
    expect(screen.getByTestId('pool-count')).toHaveTextContent('题池 0 词');
    expect(screen.getByTestId('start')).toBeDisabled();
    expect(screen.getByText('题池为空，请调整年级/学期/单元筛选')).toBeInTheDocument();
  });

  it('题池不足所选题数时提示仅 N 题', () => {
    renderWord();
    clickChip('grades', '二年级');
    const pool = screen.getByTestId('pool-count');
    expect(pool).toHaveTextContent('题池 1 词');
    expect(pool).toHaveTextContent('题池仅 1 题');
  });

  it('四选一题池不足 4 条时报错', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('answer-modes', '四选一');
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByRole('alert')).toHaveTextContent('题池少于 4 条');
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });

  it('听写模式下四选一被禁用', () => {
    renderWord();
    clickChip('word-modes', '听写');
    expect(within(screen.getByTestId('answer-modes')).getByRole('button', { name: '四选一' })).toBeDisabled();
  });
});
