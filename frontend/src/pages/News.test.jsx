import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import News from './News';

global.fetch = vi.fn();

const mockArticles = [
  { id: 1, title: 'NATO summit', source: 'Reuters', published_at: new Date().toISOString(),
    criticality_score: 92, criticality_reason: 'Active conflict', url: 'http://a.com' },
  { id: 2, title: 'Weather update', source: 'BBC', published_at: new Date().toISOString(),
    criticality_score: null, criticality_reason: null, url: 'http://b.com' },
];

describe('News page', () => {
  beforeEach(() => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ articles: mockArticles }),
    });
  });

  it('renders page heading', async () => {
    const { unmount } = render(<MemoryRouter><News /></MemoryRouter>);
    expect(screen.getByText(/live headlines/i)).toBeTruthy();
    // Wait for initial fetch to complete to avoid act() warnings
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    unmount();
  });

  it('renders article titles after fetch', async () => {
    render(<MemoryRouter><News /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('NATO summit')).toBeTruthy();
    });
  });

  it('shows CRITICAL section for high-scored articles', async () => {
    render(<MemoryRouter><News /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/critical/i)).toBeTruthy();
    });
  });

  it('shows Scoring… for unscored articles', async () => {
    render(<MemoryRouter><News /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/scoring/i)).toBeTruthy();
    });
  });
});
