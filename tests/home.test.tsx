import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';

function flushRoute() {
  act(() => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

afterEach(() => {
  window.location.hash = '';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

describe('首页导航 (FR-HOME-01)', () => {
  it('点击数学卡片进入口算配置，可返回首页', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-数学'));
    flushRoute();
    expect(screen.getByTestId('config')).toBeInTheDocument();

    window.location.hash = '#/';
    flushRoute();
    expect(screen.getByTestId('card-英语')).toBeInTheDocument();
  });

  it('点击英语卡片进入英语 hub，返回首页可用', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-英语'));
    flushRoute();
    expect(screen.getByTestId('english-hub')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('back-home'));
    flushRoute();
    expect(screen.getByTestId('card-语文')).toBeInTheDocument();
  });

  it('英语 hub 可进入单词练习并返回 hub', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-英语'));
    flushRoute();

    fireEvent.click(screen.getByTestId('hub-word'));
    expect(await screen.findByTestId('english-word')).toBeInTheDocument();
    expect(screen.getByTestId('config')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(await screen.findByTestId('english-hub')).toBeInTheDocument();
  });

  it('英语 hub 可进入语句练习并返回 hub', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-英语'));
    flushRoute();

    fireEvent.click(screen.getByTestId('hub-sentence'));
    expect(await screen.findByTestId('english-sentence')).toBeInTheDocument();
    expect(screen.getByTestId('config')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(await screen.findByTestId('english-hub')).toBeInTheDocument();
  });

  it('点击语文卡片进入 Phase 3 占位', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-语文'));
    flushRoute();
    expect(screen.getByTestId('chinese-placeholder')).toBeInTheDocument();
    expect(screen.getByText(/即将推出（Phase 3）/)).toBeInTheDocument();
  });
});
