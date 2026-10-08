import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import WordEntryScreen from '@/features/english/word/WordEntryScreen';
import { EN2ZH } from './word-fixture';

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

function submitAnswer(value: string) {
  const input = screen.getByTestId('answer-input');
  fireEvent.change(input, { target: { value } });
  const form = input.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function advance(isLast: boolean) {
  fireEvent.click(screen.getByRole('button', { name: isLast ? '查看结果' : '继续' }));
}

describe('听写模式 (FR-ENG-03/06)', () => {
  it('题干为听力入口 + 重播按钮，答对出结果', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('word-modes', '听写');
    fireEvent.click(screen.getByTestId('start'));

    expect(screen.getByTestId('quiz')).toBeInTheDocument();
    expect(screen.getByTestId('stem')).toHaveTextContent('听录音，写出单词');
    expect(screen.getByTestId('replay')).toHaveAttribute('aria-label', '重播');

    submitAnswer('sheep');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
    advance(true);

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('共 1 题');
  });

  it('答错揭示英文+音标+中文', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('word-modes', '听写');
    fireEvent.click(screen.getByTestId('start'));

    submitAnswer('cow');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答错了');
    const reveal = screen.getByTestId('answer-reveal');
    expect(reveal).toHaveTextContent('sheep');
    expect(reveal).toHaveTextContent('/ʃiːp/');
    expect(reveal).toHaveTextContent('绵羊');
    advance(true);
    expect(screen.getByTestId('summary')).toHaveTextContent('0%');
  });

  it('听写不支持四选一：配置页禁用该选项', () => {
    renderWord();
    clickChip('word-modes', '听写');
    expect(within(screen.getByTestId('answer-modes')).getByRole('button', { name: '四选一' })).toBeDisabled();
  });
});

describe('中译英输入 (FR-ENG-02)', () => {
  it('中文题干，英文答案归一化判题', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('word-modes', '中译英');
    fireEvent.click(screen.getByTestId('start'));

    const stem = screen.getByTestId('stem').querySelector('p')?.textContent ?? '';
    const en = Object.entries(EN2ZH).find(([, zh]) => zh === stem)?.[0];
    expect(en).toBeTruthy();

    submitAnswer(`  ${en!.toUpperCase()}!  `);
    expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
    advance(true);
    expect(screen.getByTestId('summary')).toHaveTextContent('100%');
  });
});

describe('手写模式 OCR 降级 (FR-ENG-04)', () => {
  it('canvas 不可用时切换键盘输入并提示', () => {
    renderWord();
    clickChip('grades', '二年级');
    clickChip('answer-modes', '手写');
    fireEvent.click(screen.getByTestId('start'));

    expect(screen.getByTestId('ocr-fallback')).toHaveTextContent('OCR 不可用，已切换键盘输入');
    expect(screen.queryByTestId('handwriting-pad')).not.toBeInTheDocument();
    expect(screen.getByTestId('answer-input')).toBeInTheDocument();

    submitAnswer('绵羊');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
  });
});
