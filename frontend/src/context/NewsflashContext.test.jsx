import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useContext } from 'react';

const { mockSubscribe, mockOn, mockOff, mockConnect, mockUnsubscribe } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockOn: vi.fn(),
  mockOff: vi.fn(),
  mockConnect: vi.fn().mockResolvedValue(),
  mockUnsubscribe: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

vi.mock('../services/wsService', () => ({
  default: {
    connect: mockConnect,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    on: mockOn,
    off: mockOff,
    isConnected: true,
  },
}));

import { NewsflashContext, NewsflashProvider } from './NewsflashContext';

function TestConsumer({ onRender }) {
  const ctx = useContext(NewsflashContext);
  onRender(ctx);
  return null;
}

describe('NewsflashProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to news channel on mount', () => {
    render(<NewsflashProvider><div /></NewsflashProvider>);
    expect(mockSubscribe).toHaveBeenCalledWith('news');
  });

  it('exposes empty toasts initially', () => {
    let ctx;
    render(
      <NewsflashProvider>
        <TestConsumer onRender={(c) => { ctx = c; }} />
      </NewsflashProvider>
    );
    expect(ctx.toasts).toEqual([]);
  });

  it('adds a toast when newsflash event fires', () => {
    let newsflashHandler;
    mockOn.mockImplementation((event, cb) => { if (event === 'newsflash') newsflashHandler = cb; });

    let ctx;
    render(
      <NewsflashProvider>
        <TestConsumer onRender={(c) => { ctx = c; }} />
      </NewsflashProvider>
    );

    const payload = { id: 1, title: 'NATO summit', criticality_score: 92, source: 'Reuters', url: 'http://a.com' };
    act(() => newsflashHandler(payload));
    expect(ctx.toasts).toHaveLength(1);
    expect(ctx.toasts[0]).toMatchObject({ title: 'NATO summit' });
  });

  it('caps toasts at 3, dropping oldest', () => {
    let newsflashHandler;
    mockOn.mockImplementation((event, cb) => { if (event === 'newsflash') newsflashHandler = cb; });

    let ctx;
    render(
      <NewsflashProvider>
        <TestConsumer onRender={(c) => { ctx = c; }} />
      </NewsflashProvider>
    );

    act(() => {
      [1, 2, 3, 4].forEach((id) =>
        newsflashHandler({ id, title: `Title ${id}`, criticality_score: 90, source: 'S', url: 'http://x.com' })
      );
    });
    expect(ctx.toasts).toHaveLength(3);
    expect(ctx.toasts[0].id).toBe(4); // newest first
  });
});
