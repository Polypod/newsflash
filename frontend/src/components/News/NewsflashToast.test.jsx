import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NewsflashContext } from '../../context/NewsflashContext';
import NewsflashToast from './NewsflashToast';

const toast = { _toastId: 1, id: 1, title: 'NATO summit', criticality_score: 92,
                 source: 'Reuters', url: 'http://a.com' };

function withContext(toasts, dismiss = vi.fn()) {
  return (
    <MemoryRouter>
      <NewsflashContext.Provider value={{ toasts, dismiss }}>
        <NewsflashToast />
      </NewsflashContext.Provider>
    </MemoryRouter>
  );
}

describe('NewsflashToast', () => {
  it('renders nothing when toasts is empty', () => {
    const { container } = render(withContext([]));
    expect(container.firstChild).toBeNull();
  });

  it('renders toast title', () => {
    render(withContext([toast]));
    expect(screen.getByText('NATO summit')).toBeTruthy();
  });

  it('calls dismiss when close button is clicked', async () => {
    const dismiss = vi.fn();
    render(withContext([toast], dismiss));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(dismiss).toHaveBeenCalledWith(1);
  });

  it('shows score badge', () => {
    render(withContext([toast]));
    expect(screen.getByText('92')).toBeTruthy();
  });
});
