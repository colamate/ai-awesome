import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import { createRepo } from '../src/data/repo';
import type { Question } from '../src/core/types';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/math';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

afterEach(() => {
  window.location.hash = '';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

function startFixedSubtraction(answerMode: 'input' | 'choice4' = 'input') {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '加法' }));
  fireEvent.click(screen.getByRole('button', { name: '减法' }));
  fireEvent.change(screen.getByLabelText('被减数'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('减数'), { target: { value: '3' } });
  if (answerMode === 'choice4') {
    fireEvent.click(screen.getByRole('button', { name: '四选一' }));
  }
  fireEvent.click(screen.getByTestId('start'));
  expect(screen.getByTestId('quiz')).toBeInTheDocument();
}

function submitAnswer(value: string) {
  const input = screen.getByTestId('answer-input');
  fireEvent.change(input, { target: { value } });
  const form = input.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function clickChoice(value: string) {
  fireEvent.click(within(screen.getByTestId('choices')).getByText(value));
}

describe('输入答题全流程 (FR-MATH-09/10)', () => {
  it('配置 → 10 题 → 结果页，会话落库', () => {
    startFixedSubtraction();
    expect(screen.getByText('10 - 3 = ?')).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      submitAnswer('7');
      expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '查看结果' : '继续' }));
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('总用时');

    const sessions = createRepo().listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.answers).toHaveLength(10);
    expect(sessions[0]?.answers.every((a) => a.correct)).toBe(true);
    expect(sessions[0]?.mode).toBe('normal');
    expect(createRepo().listMistakes()).toHaveLength(0);
  });

  it('答错展示解题思路并入易错题库 (Q-10)', () => {
    startFixedSubtraction();

    submitAnswer('9');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答错了');
    expect(screen.getByTestId('feedback')).toHaveTextContent('正确答案是 7');
    expect(screen.getByText(/解题思路/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续' }));

    for (let i = 1; i < 10; i += 1) {
      submitAnswer('7');
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '查看结果' : '继续' }));
    }

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('90%');
    expect(summary).toHaveTextContent('答错的题');

    const mistakes = createRepo().listMistakes();
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]?.wrongCount).toBe(1);
    expect(mistakes[0]?.question.answer).toBe(7);
  });
});

describe('四选一答题 (Q-04)', () => {
  it('点选选项即判题，全流程完成', () => {
    startFixedSubtraction('choice4');
    expect(screen.getByTestId('choices')).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      clickChoice('7');
      expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '查看结果' : '继续' }));
    }

    expect(screen.getByTestId('summary')).toHaveTextContent('100%');
    expect(createRepo().listSessions()).toHaveLength(1);
  });
});

describe('打印试卷 (FR-MATH-11)', () => {
  it('生成 A4 试卷并可切换含答案', () => {
    render(<App />);
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

describe('易错题页 (FR-MATH-13)', () => {
  it('空态展示提示', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '易错题' }));
    expect(screen.getByText('暂无易错题，先去练习吧')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByTestId('config')).toBeInTheDocument();
  });

  it('专项练习可作答并出结果', () => {
    const seed: Question = {
      fingerprint: 'sub:seed:10-3',
      type: 'sub',
      display: '10 - 3 = ?',
      answer: 7,
      answerText: '7',
      hint: '10 减 3 等于 7',
    };
    createRepo().addMistake(seed, Date.now());

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '易错题' }));
    expect(screen.getByText('10 - 3 = ?')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('start-mistakes'));
    expect(screen.getByTestId('quiz')).toBeInTheDocument();
    submitAnswer('7');
    expect(screen.getByTestId('feedback')).toHaveTextContent('答对了');
    fireEvent.click(screen.getByRole('button', { name: '查看结果' }));

    const summary = screen.getByTestId('summary');
    expect(summary).toHaveTextContent('100%');
    expect(summary).toHaveTextContent('共 1 题');
    expect(createRepo().listSessions()[0]?.mode).toBe('mistake');
    expect(createRepo().listMistakes()).toHaveLength(1);
  });
});

describe('清空本地数据 (Q-13)', () => {
  it('确认后清空配置、会话与易错题', () => {
    const repo = createRepo();
    repo.saveConfig({ operations: ['add'], questionCount: 20, answerMode: 'input', rangeTier: 50 });
    repo.addMistake(
      { fingerprint: 'fp:seed', type: 'add', display: '1 + 1 = ?', answer: 2, answerText: '2', hint: 'h' },
      Date.now(),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByTestId('clear-data'));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(repo.getConfig()).toBeNull();
    expect(repo.listMistakes()).toHaveLength(0);
    expect(repo.listSessions()).toHaveLength(0);
    confirmSpy.mockRestore();
  });
});
