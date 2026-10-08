import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SentenceEntryScreen from '@/features/english/sentence/SentenceEntryScreen';
import { createEngRepo } from '@/data/englishRepo';
import { SENT_EN2ZH } from '../../word/__tests__/word-fixture';

vi.mock('@/data/textbooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/textbooks')>();
  const { fixtureTb } = await import('../../word/__tests__/word-fixture');
  return { ...actual, loadEnglishTextbook: () => fixtureTb };
});

beforeEach(() => {
  localStorage.clear();
});

function renderSentence() {
  return render(<SentenceEntryScreen onExit={vi.fn()} />);
}

function currentStem(): string {
  return screen.getByTestId('stem').querySelector('p')?.textContent ?? '';
}

function zhOf(en: string): string {
  const zh = SENT_EN2ZH[en];
  if (zh === undefined) throw new Error(`fixture 缺少句子: ${en}`);
  return zh;
}

describe('跟读模式 (FR-ENG-12, D6)', () => {
  it('不判题、不落库，对照门控推进，结束页仅回顾列表', () => {
    renderSentence();

    fireEvent.click(within(screen.getByTestId('grades')).getByRole('button', { name: '一年级' }));
    fireEvent.click(within(screen.getByTestId('sentence-modes')).getByRole('button', { name: '跟读' }));

    expect(screen.queryByTestId('answer-modes')).toBeNull();
    expect(screen.getByTestId('pool-count')).toHaveTextContent('题池 10 句');

    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('quiz')).toBeInTheDocument();
    expect(screen.queryByTestId('answer-input')).toBeNull();
    expect(screen.queryByTestId('choices')).toBeNull();
    expect(screen.queryByTestId('feedback')).toBeNull();
    expect(screen.queryByTestId('next')).toBeNull();
    expect(screen.getByTestId('show-compare')).toBeInTheDocument();

    const slow = screen.getByTestId('speed-slow');
    const normal = screen.getByTestId('speed-normal');
    expect(slow).toHaveAttribute('aria-pressed', 'false');
    expect(normal).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(slow);
    expect(slow).toHaveAttribute('aria-pressed', 'true');
    expect(normal).toHaveAttribute('aria-pressed', 'false');

    const seen: string[] = [];
    const notes = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const en = currentStem();
      seen.push(en);

      fireEvent.click(screen.getByTestId('show-compare'));
      const compare = screen.getByTestId('compare');
      expect(compare).toHaveTextContent(en);
      expect(compare).toHaveTextContent(zhOf(en));
      expect(within(compare).getByTestId('syntax-plain')).toHaveTextContent(en);
      expect(screen.getByTestId('speak-answer')).toBeInTheDocument();
      for (const note of screen.queryAllByTestId('zh-note')) {
        notes.add(note.textContent ?? '');
      }

      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '查看结果' : '下一题' }));
    }

    expect([...notes].sort()).toEqual(['can 会、能', 'well 好地']);

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('跟读完成');
    expect(summary).not.toHaveTextContent('100%');
    const items = within(screen.getByTestId('review-list')).getAllByRole('listitem');
    expect(items).toHaveLength(10);
    for (const en of seen) {
      expect(summary).toHaveTextContent(en);
      expect(summary).toHaveTextContent(zhOf(en));
    }

    const repo = createEngRepo();
    expect(repo.listSessions()).toHaveLength(0);
    expect(repo.listMistakes()).toHaveLength(0);
  });
});
