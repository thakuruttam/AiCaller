import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider } from '../../context/ConfirmContext';

const apiPost = vi.fn();
vi.mock('../../api/axios', () => ({
  default: { post: (...a) => apiPost(...a) },
}));

const ChatWidget = (await import('./ChatWidget.jsx')).default;

function renderWidget() {
  return render(
    <ConfirmProvider>
      <ChatWidget />
    </ConfirmProvider>
  );
}

beforeEach(() => {
  apiPost.mockReset();
});

describe('ChatWidget', () => {
  it('renders only the launcher until opened', () => {
    renderWidget();
    expect(screen.getByRole('button', { name: /ask the assistant/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /assistant/i })).not.toBeInTheDocument();
  });

  it('opens the panel on launcher click, with an empty-state hint', async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /ask the assistant/i }));
    expect(screen.getByRole('dialog', { name: /assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/ask me how to use ai caller pro/i)).toBeInTheDocument();
  });

  it('sends a message and renders the reply', async () => {
    apiPost.mockResolvedValue({ data: { reply: 'You can create a campaign from the sidebar.', remaining: { hour: 5, day: 19 } } });
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /ask the assistant/i }));

    const input = screen.getByLabelText('Message');
    await user.type(input, 'How do I create a campaign?{Enter}');

    expect(screen.getByText('How do I create a campaign?')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('You can create a campaign from the sidebar.')).toBeInTheDocument());
    expect(apiPost).toHaveBeenCalledWith('/api/chatbot/message', expect.objectContaining({ message: 'How do I create a campaign?' }));
  });

  it('renders the hourly rate-limit banner and disables input, driven off the response code', async () => {
    apiPost.mockRejectedValue({ response: { status: 429, data: { error: "You've reached the hourly limit (6 questions). Try again in a bit.", code: 'RATE_LIMIT_USER_HOUR' } } });
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /ask the assistant/i }));

    await user.type(screen.getByLabelText('Message'), 'one more question{Enter}');

    await waitFor(() => expect(screen.getByText(/hit the hourly limit/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Message')).toBeDisabled();
  });

  it('renders the workspace-cap banner distinctly from the per-user banner', async () => {
    apiPost.mockRejectedValue({ response: { status: 429, data: { error: 'Your workspace has reached its daily limit for the assistant. Ask an admin, or try again tomorrow.', code: 'RATE_LIMIT_WORKSPACE_DAY' } } });
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /ask the assistant/i }));

    await user.type(screen.getByLabelText('Message'), 'hi{Enter}');

    await waitFor(() => expect(screen.getByText(/workspace has hit today's limit/i)).toBeInTheDocument());
  });
});
