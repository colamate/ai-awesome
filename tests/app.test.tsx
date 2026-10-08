import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { render, screen } from '@testing-library/react';

function setRoute(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

beforeEach(() => {
  localStorage.clear();
  setRoute('');
});

afterEach(() => {
  setRoute('');
});

describe('App shell', () => {
  it('renders the home screen by default (FR-HOME-01)', () => {
    render(<App />);
    expect(screen.getByTestId('card-语文')).toBeInTheDocument();
    expect(screen.getByTestId('card-数学')).toBeInTheDocument();
    expect(screen.getByTestId('card-英语')).toBeInTheDocument();
    expect(screen.getByText('小学练习')).toBeInTheDocument();
  });

  it('renders the math config screen at #/math', () => {
    setRoute('#/math');
    render(<App />);
    expect(screen.getByTestId('config')).toBeInTheDocument();
    expect(screen.getByText('数学口算')).toBeInTheDocument();
  });

  it('renders the english hub at #/english', () => {
    setRoute('#/english');
    render(<App />);
    expect(screen.getByTestId('english-hub')).toBeInTheDocument();
  });

  it('renders the chinese placeholder at #/chinese', () => {
    setRoute('#/chinese');
    render(<App />);
    expect(screen.getByTestId('chinese-placeholder')).toBeInTheDocument();
  });

  it('falls back to home for unknown routes', () => {
    setRoute('#/nope');
    render(<App />);
    expect(screen.getByTestId('card-数学')).toBeInTheDocument();
  });
});
