import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const addToastMock = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ addToast: addToastMock }) }));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('../../api/axios', () => ({ default: { get: (...a) => apiGet(...a), post: (...a) => apiPost(...a), put: (...a) => apiPut(...a) } }));

// Stub every step component to a minimal, test-controllable shape — CampaignWizard's own
// orchestration logic (step nav, weight validation, launch/update, edit-mode data mapping)
// is what's under test here, not each step's own internal UI.
vi.mock('./components/Step1Basics', () => ({ default: ({ payload }) => <div data-testid="step-basics">Step1Basics name={payload.name}</div> }));
vi.mock('./components/Step5Contacts', () => ({ default: () => <div data-testid="step-contacts">Step5Contacts</div> }));
vi.mock('./components/Step3DataToCollect', () => ({
  default: ({ updatePayload }) => (
    <div data-testid="step-questions">
      Step3DataToCollect
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: 'Q1', weight: 60 },
        { itemType: 'question', text: 'Q2', weight: 60 },
      ] })}>Set Overweight Questions</button>
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: '', weight: 10 },
      ] })}>Set Empty-Text Question</button>
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: 'Q1', weight: 40 },
      ] })}>Set Valid Question</button>
    </div>
  ),
}));
vi.mock('./components/StepContactOverrides', () => ({ default: () => <div data-testid="step-overrides">StepContactOverrides</div> }));
vi.mock('./components/Step7Review', () => ({
  default: ({ onLaunch }) => <div data-testid="step-review"><button onClick={onLaunch}>Trigger Launch</button></div>,
}));

const CampaignWizard = (await import('./CampaignWizard.jsx')).default;

function renderWizard(path = '/create-campaign') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create-campaign" element={<CampaignWizard />} />
        <Route path="/edit-campaign/:id" element={<CampaignWizard />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function goToStep3(user) {
  await user.click(screen.getByRole('button', { name: /next: contacts/i }));
  await user.click(screen.getByRole('button', { name: /next: setup questions/i }));
}

beforeEach(() => {
  addToastMock.mockReset();
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
});

describe('CampaignWizard — creation mode', () => {
  it('starts on step 1 (Basics) with 20% progress', () => {
    renderWizard();
    expect(screen.getByTestId('step-basics')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('advances through steps via the Next button', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /next: contacts/i }));
    expect(screen.getByTestId('step-contacts')).toBeInTheDocument();
  });

  it('Previous Step is disabled on step 1', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /previous step/i })).toBeDisabled();
  });

  it('does not call the API on mount when there is no campaign id', () => {
    renderWizard();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('CampaignWizard — step 3 weight/text validation', () => {
  it('blocks advancing when total question weight exceeds 100%', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep3(user);

    await user.click(screen.getByRole('button', { name: /set overweight questions/i }));
    await user.click(screen.getByRole('button', { name: /next: overrides/i }));

    expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('exceeds 100%'), 'error');
    expect(screen.getByTestId('step-questions')).toBeInTheDocument(); // did not advance
  });

  it('blocks advancing when a question has no text', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep3(user);

    await user.click(screen.getByRole('button', { name: /set empty-text question/i }));
    await user.click(screen.getByRole('button', { name: /next: overrides/i }));

    expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('no text'), 'error');
    expect(screen.getByTestId('step-questions')).toBeInTheDocument();
  });

  it('allows advancing when questions are valid and within the weight limit', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep3(user);

    await user.click(screen.getByRole('button', { name: /set valid question/i }));
    await user.click(screen.getByRole('button', { name: /next: overrides/i }));

    expect(screen.getByTestId('step-overrides')).toBeInTheDocument();
  });
});

describe('CampaignWizard — launch (create mode)', () => {
  async function goToStep5(user) {
    await goToStep3(user);
    await user.click(screen.getByRole('button', { name: /next: overrides/i }));
    await user.click(screen.getByRole('button', { name: /next: final review/i }));
  }

  it('POSTs to /api/campaigns/wizard, resets to step 1, and navigates home on success', async () => {
    apiPost.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWizard();
    await goToStep5(user);
    expect(screen.getByTestId('step-review')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /trigger launch/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.any(Object)));
    expect(addToastMock).toHaveBeenCalledWith('Campaign launched successfully!', 'success');
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('shows an error toast and does not navigate when the launch API call fails', async () => {
    apiPost.mockRejectedValue({ response: { data: { error: 'Something went wrong' } } });
    const user = userEvent.setup();
    renderWizard();
    await goToStep5(user);
    await user.click(screen.getByRole('button', { name: /trigger launch/i }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith('Something went wrong', 'error'));
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('CampaignWizard — edit mode', () => {
  it('fetches the campaign by id on mount and maps the response into the wizard payload', async () => {
    apiGet.mockResolvedValue({
      data: {
        name: 'Existing Campaign',
        type: 'SALES',
        endCallIf: 'user hangs up',
        dataToCollect: [{ id: 'q1', text: 'Question?' }],
        rules: { successScore: 70, list: [], fieldsToExtract: [], scoringRules: [] },
        callSettings: { tone: 'Casual', language: 'English', maxDuration: 4, retryAttempts: 1 },
        callModule: { goal: 'close deals', callIntro: 'hi', callSignOff: 'bye' },
        campaignContacts: [{ overrides: { name: 'Override' }, contact: { name: 'Real Name', phone: '+1' } }],
      },
    });

    renderWizard('/edit-campaign/campaign-123');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/campaigns/campaign-123'));
    await waitFor(() => expect(screen.getByTestId('step-basics')).toBeInTheDocument());
    expect(screen.getByText(/name=Existing Campaign/)).toBeInTheDocument();
  });

  it('shows an error toast when the edit-mode fetch fails, and still renders the wizard', async () => {
    apiGet.mockRejectedValue(new Error('network error'));
    renderWizard('/edit-campaign/campaign-404');
    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith('Error loading campaign data', 'error'));
    expect(screen.getByTestId('step-basics')).toBeInTheDocument();
  });

  it('PUTs to /api/campaigns/wizard/:id (not POST) when launching in edit mode', async () => {
    apiGet.mockResolvedValue({ data: { name: 'X', campaignContacts: [] } });
    apiPut.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWizard('/edit-campaign/campaign-123');
    await waitFor(() => expect(screen.getByTestId('step-basics')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /next: contacts/i }));
    await user.click(screen.getByRole('button', { name: /next: setup questions/i }));
    await user.click(screen.getByRole('button', { name: /next: overrides/i }));
    await user.click(screen.getByRole('button', { name: /next: final review/i }));
    await user.click(screen.getByRole('button', { name: /trigger launch/i }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/api/campaigns/wizard/campaign-123', expect.any(Object)));
    expect(apiPost).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith('Campaign updated successfully!', 'success');
  });
});
