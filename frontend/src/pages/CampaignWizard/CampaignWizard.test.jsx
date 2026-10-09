import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Rewritten for the single-page builder. The old suite drove a five-step
// wizard (Next ×4, progress %, "Previous is disabled on step 1"); those
// steps no longer exist, so the navigation assertions went with them. Every
// assertion that was about real behaviour — what gets POSTed vs PUT,
// edit-mode payload mapping, the validation gates, scheduling, and the fact
// that creating now also starts the campaign — is kept or extended below.

const addToastMock = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ addToast: addToastMock }) }));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('../../api/axios', () => ({
  default: { get: (...a) => apiGet(...a), post: (...a) => apiPost(...a), put: (...a) => apiPut(...a) },
}));

// Each section's own UI is tested elsewhere; what's under test here is the
// page's orchestration — readiness, persistence, and launch.
vi.mock('./components/Step1Basics', () => ({
  default: ({ payload, updatePayload }) => (
    <div data-testid="section-basics">
      Step1Basics name={payload.name}
      <button onClick={() => updatePayload({ name: 'Named', type: 'HR' })}>Set Basics</button>
      <button onClick={() => updatePayload({ scheduledAt: '2027-01-01T05:30:00.000Z' })}>Set Schedule</button>
    </div>
  ),
}));
vi.mock('./components/Step5Contacts', () => ({
  default: ({ updatePayload }) => (
    <div data-testid="section-contacts">
      Step5Contacts
      <button onClick={() => updatePayload({ contacts: [{ name: 'A', phone: '+911', overrides: {} }] })}>
        Add Contact
      </button>
    </div>
  ),
}));
vi.mock('./components/Step3DataToCollect', () => ({
  default: ({ updatePayload }) => (
    <div data-testid="section-questions">
      Step3DataToCollect
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: 'Q1', weight: 60 },
        { itemType: 'question', text: 'Q2', weight: 60 },
      ] })}>Set Overweight Questions</button>
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: '', weight: 100 },
      ] })}>Set Empty-Text Question</button>
      <button onClick={() => updatePayload({ dataToCollect: [
        { itemType: 'question', text: 'Q1', weight: 100 },
      ] })}>Set Valid Question</button>
    </div>
  ),
}));
vi.mock('./components/StepContactOverrides', () => ({
  default: () => <div data-testid="section-overrides">StepContactOverrides</div>,
}));
vi.mock('./components/BriefPanel', () => ({
  default: ({ onDraft }) => (
    <div data-testid="brief-panel">
      <button onClick={() => onDraft({
        name: 'Drafted Campaign',
        type: 'SALES',
        goals: { goal: 'g', callIntro: 'i', callSignOff: 's' },
        dataToCollect: [{ itemType: 'question', text: 'Drafted Q', weight: 100 }],
        endCallIf: '',
        rules: {},
        callSettings: { language: 'English', maxDuration: 5, retryAttempts: 2 },
      })}>Apply Draft</button>
    </div>
  ),
}));

const CampaignWizard = (await import('./CampaignWizard.jsx')).default;

function renderBuilder(path = '/create-campaign') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create-campaign" element={<CampaignWizard />} />
        <Route path="/edit-campaign/:id" element={<CampaignWizard />} />
        <Route path="/campaigns/:id" element={<div>Campaign Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const open = async (user, name) => {
  const header = screen.getByRole('button', { name });
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
};
const toggle = (user, name) => user.click(screen.getByRole('button', { name }));

/** Minimum viable campaign: a name, one valid question, one contact. */
async function makeReady(user) {
  await open(user, 'Campaign & script');
  await user.click(screen.getByRole('button', { name: 'Set Basics' }));
  await open(user, 'Questions & scoring');
  await user.click(screen.getByRole('button', { name: 'Set Valid Question' }));
  await open(user, 'Contacts');
  await user.click(screen.getByRole('button', { name: 'Add Contact' }));
}

beforeEach(() => {
  addToastMock.mockReset();
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
});

describe('CampaignWizard — one page, not five steps', () => {
  it('renders every section on a single screen', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: 'Campaign & script' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Questions & scoring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Per-contact overrides' })).toBeInTheDocument();
  });

  it('has no Next buttons at all', () => {
    renderBuilder();
    expect(screen.queryByRole('button', { name: /next:/i })).not.toBeInTheDocument();
  });

  it('opens one section at a time and toggles it shut again', async () => {
    const user = userEvent.setup();
    renderBuilder();
    // Create mode starts on Basics.
    expect(screen.getByTestId('section-basics')).toBeInTheDocument();

    await toggle(user, 'Questions & scoring');
    expect(screen.getByTestId('section-questions')).toBeInTheDocument();
    expect(screen.queryByTestId('section-basics')).not.toBeInTheDocument();

    await toggle(user, 'Questions & scoring');
    expect(screen.queryByTestId('section-questions')).not.toBeInTheDocument();
  });

  it('does not call the API on mount when there is no campaign id', () => {
    renderBuilder();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('CampaignWizard — readiness replaces the Review step', () => {
  it('blocks launch and names the problem when weights exceed 100%', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await open(user, 'Questions & scoring');
    await user.click(screen.getByRole('button', { name: 'Set Overweight Questions' }));

    expect(screen.getByText(/weights total 120%/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & start calling/i })).toBeDisabled();
  });

  it('blocks launch when a question has no text', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await open(user, 'Questions & scoring');
    await user.click(screen.getByRole('button', { name: 'Set Empty-Text Question' }));

    expect(screen.getByText(/has no text/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & start calling/i })).toBeDisabled();
  });

  it('blocks launch when the campaign has no name', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await open(user, 'Questions & scoring');
    await user.click(screen.getByRole('button', { name: 'Set Valid Question' }));

    expect(screen.getByText(/give the campaign a name/i)).toBeInTheDocument();
  });

  it('enables launch once name, questions and contacts are all present', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await makeReady(user);
    expect(screen.getByRole('button', { name: /create & start calling/i })).toBeEnabled();
  });
});

describe('CampaignWizard — create and start', () => {
  beforeEach(() => {
    apiPost.mockImplementation((url) => {
      if (url === '/api/campaigns/wizard') return Promise.resolve({ data: { campaign: { id: 'new-1' } } });
      return Promise.resolve({ data: {} });
    });
  });

  it('creates the campaign and then starts it, landing on the campaign page', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await makeReady(user);
    await user.click(screen.getByRole('button', { name: /create & start calling/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.any(Object)));
    // The whole point of the change: creating no longer leaves it in draft.
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/new-1/status', { action: 'start' }));
    await waitFor(() => expect(screen.getByText('Campaign Page')).toBeInTheDocument());
  });

  it('schedules instead of starting when a launch time is set', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await makeReady(user);
    await open(user, 'Campaign & script');
    await user.click(screen.getByRole('button', { name: 'Set Schedule' }));

    await user.click(screen.getByRole('button', { name: /create & schedule/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.objectContaining({
      scheduledAt: '2027-01-01T05:30:00.000Z',
    })));
    // Starting now would dial everyone immediately — the opposite of scheduling.
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/new-1/status', { action: 'start' });
    expect(addToastMock).toHaveBeenCalledWith(expect.stringMatching(/scheduled for/i), 'success');
  });

  it('saves without starting when using "Save, don\'t call yet"', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await makeReady(user);
    await user.click(screen.getByRole('button', { name: /save, don't call yet/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.any(Object)));
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/new-1/status', { action: 'start' });
    expect(addToastMock).toHaveBeenCalledWith(expect.stringMatching(/nothing is dialling/i), 'success');
  });

  it('shows an error toast and stays put when creation fails', async () => {
    apiPost.mockRejectedValue({ response: { data: { error: 'Server exploded' } } });
    const user = userEvent.setup();
    renderBuilder();
    await makeReady(user);
    await user.click(screen.getByRole('button', { name: /create & start calling/i }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith('Server exploded', 'error'));
    expect(screen.queryByText('Campaign Page')).not.toBeInTheDocument();
  });
});

describe('CampaignWizard — drafting from a brief', () => {
  it('offers the brief panel when creating a campaign', () => {
    renderBuilder();
    expect(screen.getByTestId('brief-panel')).toBeInTheDocument();
  });

  it('hides the brief panel when editing — drafting would overwrite real work', async () => {
    apiGet.mockResolvedValue({ data: { name: 'Existing', dataToCollect: [], campaignContacts: [] } });
    renderBuilder('/edit-campaign/abc');
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByTestId('brief-panel')).not.toBeInTheDocument();
  });

  it('applies a draft into the sections and jumps to the questions', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Apply Draft' }));

    expect(screen.getByTestId('section-questions')).toBeInTheDocument();
    expect(screen.getByText(/Drafted Campaign/)).toBeInTheDocument();
  });

  it('keeps already-imported contacts when re-drafting', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await open(user, 'Contacts');
    await user.click(screen.getByRole('button', { name: 'Add Contact' }));
    await user.click(screen.getByRole('button', { name: 'Apply Draft' }));

    // The contacts summary still reports one contact after the draft landed.
    expect(screen.getByText(/1 contact ·/)).toBeInTheDocument();
  });
});

describe('CampaignWizard — edit mode', () => {
  it('fetches by id and maps the response into the builder', async () => {
    apiGet.mockResolvedValue({
      data: {
        name: 'Existing Campaign',
        type: 'HR',
        dataToCollect: [{ itemType: 'question', text: 'Q', weight: 100 }],
        callModule: { goal: 'g', callIntro: 'i', callSignOff: 's' },
        campaignContacts: [{ contact: { name: 'C', phone: '+9111' }, overrides: {} }],
        callSettings: { language: 'English', maxDuration: 5 },
        rules: {},
      },
    });

    renderBuilder('/edit-campaign/abc');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/campaigns/abc'));
    // Edit mode opens on the questions, which is what people come back for.
    await waitFor(() => expect(screen.getByTestId('section-questions')).toBeInTheDocument());
    expect(screen.getByText(/Existing Campaign/)).toBeInTheDocument();
  });

  it('shows an error toast when the fetch fails, and still renders the builder', async () => {
    apiGet.mockRejectedValue(new Error('nope'));
    renderBuilder('/edit-campaign/abc');

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith(expect.stringMatching(/could not load/i), 'error'));
    expect(screen.getByRole('button', { name: 'Questions & scoring' })).toBeInTheDocument();
  });

  it('PUTs rather than POSTs when launching an existing campaign', async () => {
    apiGet.mockResolvedValue({
      data: {
        name: 'Existing Campaign',
        type: 'HR',
        dataToCollect: [{ itemType: 'question', text: 'Q', weight: 100 }],
        campaignContacts: [{ contact: { name: 'C', phone: '+9111' }, overrides: {} }],
        callSettings: { maxDuration: 5 },
        rules: {},
      },
    });
    apiPut.mockResolvedValue({ data: {} });
    apiPost.mockResolvedValue({ data: {} });

    const user = userEvent.setup();
    renderBuilder('/edit-campaign/abc');
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /create & start calling/i }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/api/campaigns/wizard/abc', expect.any(Object)));
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/wizard', expect.any(Object));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/abc/status', { action: 'start' }));
  });
});
