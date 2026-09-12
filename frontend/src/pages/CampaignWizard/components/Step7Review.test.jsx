import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Step7Review from './Step7Review';

// jsdom has no ResizeObserver; react-datepicker's time-list panel uses one
// to reposition itself. A no-op stub is enough — layout isn't under test.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const basePayload = {
  name: 'Test Campaign',
  type: 'HR',
  goals: {},
  dataToCollect: [],
  callSettings: {},
  contacts: [],
  endCallIf: '',
  rules: {},
  scheduledAt: '2027-01-01T05:30:00.000Z',
};

describe('Step7Review — Launch Timing calendar', () => {
  it('opens a portaled calendar popup (not clipped by a scrollable ancestor) when the date field is clicked', async () => {
    const user = userEvent.setup();
    render(
      // Mirrors the real wizard: the step content sits inside an
      // overflow-y-auto scroll container — the bug this test guards against
      // is the calendar popup getting clipped by that ancestor.
      <div style={{ overflowY: 'auto', height: '100px' }}>
        <Step7Review payload={basePayload} updatePayload={() => {}} onLaunch={() => {}} />
      </div>
    );

    const dateButton = screen.getByRole('button', { name: /01 Jan 2027/i });
    await user.click(dateButton);

    await waitFor(() => {
      const portalRoot = document.getElementById('datepicker-portal');
      expect(portalRoot).toBeTruthy();
      expect(portalRoot.querySelector('.react-datepicker')).toBeTruthy();
    });
  });

  it('has no text input for the date field — a button cannot be typed into (the whole point of the fix)', () => {
    render(<Step7Review payload={basePayload} updatePayload={() => {}} onLaunch={() => {}} />);
    // The date value is exposed only via a <button>; no <input type="text">
    // (or datetime-local) exists for it anywhere in the Launch Timing card.
    expect(screen.queryByDisplayValue(/01 Jan 2027|2027-01-01/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /01 Jan 2027/i }).tagName).toBe('BUTTON');
  });

  it('renders a read-only field for a shared/view-only render (no updatePayload)', () => {
    render(<Step7Review payload={basePayload} />);
    expect(screen.getByText(/scheduled for/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /01 Jan 2027/i })).not.toBeInTheDocument();
  });
});
