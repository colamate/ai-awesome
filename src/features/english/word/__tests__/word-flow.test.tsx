import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import WordEntryScreen from '@/features/english/word/WordEntryScreen';
import { createEngRepo } from '@/data/englishRepo';
import type { EngQuestion } from '@/core/english';
import { EN2ZH, EN_IPA } from './word-fixture';

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

function currentStem(): string {
  return screen.getByTestId('stem').querySelector('p')?.textContent ?? '';
}

function zhOf(en: string): string {
  const zh = EN2ZH[en];
  if (zh === undefined) throw new Error(`fixture 缺少词条: ${en}`);
  return zh;
}

function ipaOf(en: string): string {
  const ipa = EN_IPA[en];
  if (ipa === undefined) throw new Error(`fixture 缺少音标: ${en}`);
  return ipa;
}

function submitAnswer(value: string) {
  const input = screen.getByTestId('answer-input');
  fireEvent.change(input, { target: { value } });
  const form = input.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function answerCurrentCorrectly() {
  submitAnswer(zhOf(currentStem()));
  expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
}

function advance(isLast: boolean) {
  fireEvent.click(screen.getByRole('button', { name: isLast ? '查看结果' : '继续' }));
}

describe('英译中输入全流程 (FR-ENG-01/06)', () => {
  it('配置 → 10 题 → 结果页，会话落库', () => {
    renderWord();
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('quiz')).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      answerCurrentCorrectly();
      advance(i === 9);
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('总用时');
    expect(summary).toHaveTextContent('平均每题');
    expect(summary).toHaveTextContent('最慢');
    expect(summary).toHaveTextContent('最快');

    const repo = createEngRepo();
    const sessions = repo.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.answers).toHaveLength(10);
    expect(sessions[0]?.answers.every((a) => a.correct)).toBe(true);
    expect(sessions[0]?.mode).toBe('normal');
    expect(repo.listMistakes()).toHaveLength(0);
  });

  it('题干下显示音标', () => {
    renderWord();
    fireEvent.click(screen.getByTestId('start'));
    const en = currentStem();
    expect(screen.getByTestId('ipa-chip')).toHaveTextContent(ipaOf(en));
  });
});

describe('答错展示答案并入易错题库 (FR-ENG-07/08)', () => {
  it('答错揭示英文+音标+中文，90% 结果页', () => {
    renderWord();
    fireEvent.click(screen.getByTestId('start'));

    const en = currentStem();
    submitAnswer('不存在的答案');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答错了');
    const reveal = screen.getByTestId('answer-reveal');
    expect(reveal).toHaveTextContent(en);
    expect(reveal).toHaveTextContent(ipaOf(en));
    expect(reveal).toHaveTextContent(zhOf(en));
    expect(screen.getByTestId('speak-answer')).toBeInTheDocument();
    advance(false);

    for (let i = 1; i < 10; i += 1) {
      answerCurrentCorrectly();
      advance(i === 9);
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('90%');
    expect(summary).toHaveTextContent('答错的题');

    const repo = createEngRepo();
    expect(repo.listSessions()).toHaveLength(1);
    const mistakes = repo.listMistakes();
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]?.wrongCount).toBe(1);
    expect(mistakes[0]?.question.kind).toBe('word');
  });
});

describe('四选一答题 (FR-ENG-01)', () => {
  it('点选选项即判题，全流程完成', () => {
    renderWord();
    fireEvent.click(within(screen.getByTestId('answer-modes')).getByRole('button', { name: '四选一' }));
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('choices')).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      const zh = zhOf(currentStem());
      fireEvent.click(within(screen.getByTestId('choices')).getByText(zh));
      expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
      advance(i === 9);
    }

    expect(screen.getByTestId('summary')).toHaveTextContent('100%');
    expect(createEngRepo().listSessions()).toHaveLength(1);
  });
});

describe('打印试卷 (FR-ENG-11)', () => {
  it('生成 A4 试卷并可切换含答案', () => {
    renderWord();
    fireEvent.click(screen.getByTestId('print'));
    const sheet = screen.getByTestId('print-sheet');
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: '含答案' }));
    expect(screen.getByRole('button', { name: '不含答案' })).toBeInTheDocument();
    expect(within(sheet).getByText('答案与题号对应，供家长核对。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });
});

describe('易错单词页 (FR-ENG-12)', () => {
  const seed: EngQuestion = {
    fingerprint: 'word:en2zh:猫:cat',
    kind: 'word',
    display: 'cat',
    answer: '猫',
    answerDisplay: { en: 'cat', zh: '猫', ipa: '/kæt/' },
    hint: 'cat — 猫',
  };

  it('空态展示提示', () => {
    renderWord();
    fireEvent.click(screen.getByRole('button', { name: '易错题' }));
    expect(screen.getByText('暂无易错单词，先去练习吧')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });

  it('列表展示、可移除', () => {
    createEngRepo().addMistake(seed, Date.now());
    renderWord();
    fireEvent.click(screen.getByRole('button', { name: '易错题' }));
    const list = screen.getByTestId('mistakes');
    expect(list).toHaveTextContent('cat');
    expect(list).toHaveTextContent('/kæt/');
    expect(list).toHaveTextContent('错 1 次');

    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    expect(screen.getByText('暂无易错单词，先去练习吧')).toBeInTheDocument();
    expect(createEngRepo().listMistakes()).toHaveLength(0);
  });

  it('专项练习可作答并出结果，会话为 mistake 模式', () => {
    createEngRepo().addMistake(seed, Date.now());
    renderWord();
    fireEvent.click(screen.getByRole('button', { name: '易错题' }));
    fireEvent.click(screen.getByTestId('start-mistakes'));
    expect(screen.getByTestId('quiz')).toHaveTextContent('易错专项');
    expect(currentStem()).toBe('cat');

    submitAnswer('猫');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
    advance(true);

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('共 1 题');

    const repo = createEngRepo();
    expect(repo.listSessions()[0]?.mode).toBe('mistake');
    expect(repo.listMistakes()).toHaveLength(1);
  });
});
