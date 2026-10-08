import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SentenceEntryScreen from '@/features/english/sentence/SentenceEntryScreen';
import { createEngRepo } from '@/data/englishRepo';
import { SENT_EN2ZH, SENT_ZH2EN } from '../../word/__tests__/word-fixture';

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

function enOf(zh: string): string {
  const en = SENT_ZH2EN[zh];
  if (en === undefined) throw new Error(`fixture 缺少句子: ${zh}`);
  return en;
}

function submitAnswer(value: string) {
  const input = screen.getByTestId('answer-input');
  fireEvent.change(input, { target: { value } });
  const form = input.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function advance(isLast: boolean, readAlong = false) {
  const name = readAlong ? (isLast ? '查看结果' : '下一题') : isLast ? '查看结果' : '继续';
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('英译中输入全流程 (FR-ENG-10/11)', () => {
  it('配置 → 10 题 → 结果页，会话落库且不入易错', () => {
    renderSentence();
    expect(screen.getByTestId('pool-count')).toHaveTextContent('题池 11 句');
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('quiz')).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      submitAnswer(zhOf(currentStem()));
      expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
      expect(screen.getByTestId('compare')).toBeInTheDocument();
      expect(screen.queryByTestId('hint')).toBeNull();
      advance(i === 9);
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('共 10 题，答对 10 题');

    const repo = createEngRepo();
    const sessions = repo.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.answers).toHaveLength(10);
    expect(sessions[0]?.answers.every((a) => a.correct)).toBe(true);
    expect(sessions[0]?.mode).toBe('normal');
    expect(repo.listMistakes()).toHaveLength(0);
  });

  it('输入占位提示中文', () => {
    renderSentence();
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('answer-input')).toHaveAttribute('placeholder', '输入中文句子');
  });
});

describe('答错展示对照与提示 (FR-ENG-11/13, D8)', () => {
  it('答错出 hint + 对照 + 句法降级，90% 结果页，不入易错', () => {
    renderSentence();
    fireEvent.click(screen.getByTestId('start'));

    const en = currentStem();
    submitAnswer('不存在的答案');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答错了');
    expect(screen.getByTestId('hint')).toHaveTextContent('参考译文');

    const compare = screen.getByTestId('compare');
    expect(compare).toHaveTextContent(en);
    expect(compare).toHaveTextContent(zhOf(en));
    expect(within(compare).getByTestId('syntax-plain')).toHaveTextContent(en);
    expect(screen.getByTestId('speak-answer')).toBeInTheDocument();
    advance(false);

    for (let i = 1; i < 10; i += 1) {
      submitAnswer(zhOf(currentStem()));
      advance(i === 9);
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('90%');
    expect(summary).toHaveTextContent('答错的题');

    const repo = createEngRepo();
    expect(repo.listSessions()).toHaveLength(1);
    expect(repo.listMistakes()).toHaveLength(0);
  });
});

describe('中译英全流程 (FR-ENG-11)', () => {
  it('大写英文作答判对，10 题 100%', () => {
    renderSentence();
    fireEvent.click(within(screen.getByTestId('sentence-modes')).getByRole('button', { name: '中译英' }));
    fireEvent.click(screen.getByTestId('start'));

    for (let i = 0; i < 10; i += 1) {
      submitAnswer(enOf(currentStem()).toUpperCase());
      expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
      advance(i === 9);
    }

    expect(screen.getByTestId('summary')).toHaveTextContent('100%');
    expect(createEngRepo().listSessions()).toHaveLength(1);
  });
});

describe('四选一 (FR-ENG-11)', () => {
  it('点选完整句选项判题，全流程完成', () => {
    renderSentence();
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

describe('配置边界', () => {
  it('筛选到空题池时禁用开始', () => {
    renderSentence();
    fireEvent.click(within(screen.getByTestId('grades')).getByRole('button', { name: '二年级' }));
    fireEvent.click(within(screen.getByTestId('units')).getByRole('button', { name: '第 2 单元' }));
    expect(screen.getByTestId('pool-count')).toHaveTextContent('题池 0 句');
    expect(screen.getByText('题池为空，请调整年级/学期/单元筛选')).toBeInTheDocument();
    expect(screen.getByTestId('start')).toBeDisabled();
  });

  it('题池不足 4 条时四选一报错', () => {
    renderSentence();
    fireEvent.click(within(screen.getByTestId('grades')).getByRole('button', { name: '二年级' }));
    fireEvent.click(within(screen.getByTestId('answer-modes')).getByRole('button', { name: '四选一' }));
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByRole('alert')).toHaveTextContent('题池少于 4 条');
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });
});
