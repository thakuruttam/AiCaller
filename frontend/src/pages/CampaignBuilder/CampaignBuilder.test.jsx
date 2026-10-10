import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The builder end to end, with its real steps — only the network, toasts
// and the confirm dialog are stubbed.

const addToast = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ addToast }) }));
const confirmMock = vi.fn(async () => true);
vi.mock('../../context/ConfirmContext', () => ({ useConfirm: () => confirmMock }));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('../../api/axios', () => ({
  default: { get: (...a) => apiGet(...a), post: (...a) => apiPost(...a), put: (...a) => apiPut(...a) },
}));

const CampaignBuilder = (await import('./CampaignBuilder.jsx')).default;

function renderBuilder(path = '/create-campaign') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create-campaign" element={<CampaignBuilder />} />
        <Route path="/edit-campaign/:id" element={<CampaignBuilder />} />
        <Route path="/campaigns/:id" element={<div>Campaign Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const button = (name) => screen.getByRole('button', { name });

/** Blank script → a name and one question → one pasted contact. */
async function buildReadyCampaign(user) {
  await user.click(button(/start with a blank script/i));
  await user.type(screen.getByLabelText('Campaign name'), 'Quick check');
  await user.type(screen.getByLabelText('Question 1'), 'Are you free to talk?');
  await user.click(button(/next: add people/i));
  await user.type(screen.getByLabelText('Paste names and numbers'), 'Priya Sharma, 98765 43210');
  await user.click(button(/^person_add add$/i));
}

beforeEach(() => {
  addToast.mockReset();
  confirmMock.mockClear();
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  // Saving a new campaign moves to its edit URL, which loads it back.
  apiGet.mockResolvedValue({ data: { name: 'Saved', dataToCollect: [], campaignContacts: [] } });
  apiPost.mockImplementation((url) => {
    if (url === '/api/campaigns/wizard') return Promise.resolve({ data: { campaign: { id: 'new-1' } } });
    return Promise.resolve({ data: {} });
  });
});

describe('starting a campaign', () => {
  it('opens on a choice, not a form, and loads nothing', () => {
    renderBuilder();
    expect(screen.getByLabelText('Describe your calls')).toBeInTheDocument();
    expect(button(/screen job applicants/i)).toBeInTheDocument();
    expect(button(/start with a blank script/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Campaign name')).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('a template fills in the whole script', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/screen job applicants/i));

    expect(screen.getByLabelText('Campaign name')).toHaveValue('Applicant screening');
    expect(screen.getByLabelText('Question 1')).toHaveValue('Are you still interested in this role?');
    expect(screen.getByLabelText('Opening line').value).toContain('[Name]');
    // Its deliberate gap is flagged on the line it's in.
    expect(screen.getAllByText(/Opening line: replace \[Company\]/).length).toBeGreaterThan(0);
  });

  it('writes the script from a description', async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        payload: {
          name: 'Drafted', type: 'SALES',
          goals: { goal: 'g', callIntro: 'Hi [Name]', callSignOff: 's' },
          dataToCollect: [{ itemType: 'question', text: 'Drafted question?', weight: 100, isWeightManuallySet: true }],
          callSettings: { language: 'Hinglish', maxDuration: 3 },
        },
        assumptions: ['Assumed a 3 minute limit.'],
        corrections: [],
      },
    });
    const user = userEvent.setup();
    renderBuilder();
    await user.type(screen.getByLabelText('Describe your calls'), 'Call our leads and ask if they want a demo next week.');
    await user.click(button(/write my script/i));

    await waitFor(() => expect(screen.getByLabelText('Campaign name')).toHaveValue('Drafted'));
    expect(apiPost).toHaveBeenCalledWith('/api/campaigns/draft', { brief: 'Call our leads and ask if they want a demo next week.' });
    expect(screen.getByLabelText('Question 1')).toHaveValue('Drafted question?');
    expect(screen.getByText('Assumed a 3 minute limit.')).toBeInTheDocument();
    expect(button('Hinglish')).toHaveAttribute('aria-pressed', 'true');
  });

  it('points to the templates when the server cannot write scripts', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 404, data: {} } });
    const user = userEvent.setup();
    renderBuilder();
    await user.type(screen.getByLabelText('Describe your calls'), 'Call our leads and ask if they want a demo next week.');
    await user.click(button(/write my script/i));

    expect(await screen.findByText(/isn't switched on yet/i)).toBeInTheDocument();
    expect(button(/screen job applicants/i)).toBeInTheDocument();
  });

  it('starting over keeps the people already added', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/start over/i));
    await user.click(button(/collect customer feedback/i));
    await user.click(button(/add people & start/i));
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });
});

describe('writing the script', () => {
  it('Enter adds the next question', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'First?{Enter}');
    expect(screen.getByLabelText('Question 2')).toHaveFocus();
  });

  it('moves and removes lines', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'First?{Enter}Second?');
    await user.click(button('Move line 2 up'));
    expect(screen.getByLabelText('Question 1')).toHaveValue('Second?');
    await user.click(button('Remove line 1'));
    expect(screen.getByLabelText('Question 1')).toHaveValue('First?');
    expect(screen.queryByLabelText('Question 2')).not.toBeInTheDocument();
  });

  it('keeps scoring and branching folded away until asked for', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/start with a blank script/i));
    expect(screen.queryByText('How should the answer be scored?')).not.toBeInTheDocument();
    await user.click(button(/options/i));
    expect(screen.getByText('How should the answer be scored?')).toBeInTheDocument();
    await user.click(button(/must match/i));
    expect(screen.getByLabelText('Question 1 expected answer — value')).toBeInTheDocument();
  });
});

describe('launching', () => {
  it('cannot start until everything is in place, and says what is missing', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/start with a blank script/i));
    await user.click(button(/next: add people/i));
    expect(button(/start calling/i)).toBeDisabled();
    expect(screen.getByText(/give the campaign a name/i)).toBeInTheDocument();
  });

  it('creates the campaign, starts it and opens it', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/start calling 1 person/i));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.objectContaining({
      name: 'Quick check',
      contacts: [expect.objectContaining({ name: 'Priya Sharma', phone: '+919876543210' })],
      dataToCollect: [expect.objectContaining({ text: 'Are you free to talk?', weight: 100 })],
    })));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/new-1/status', { action: 'start' }));
    expect(await screen.findByText('Campaign Page')).toBeInTheDocument();
  });

  it('schedules instead of starting when a time is picked', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(screen.getByRole('radio', { name: /later/i }));
    await user.click(button(/schedule 1 call/i));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/scheduled for/i), 'success'));
    expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.objectContaining({
      scheduledAt: expect.any(String),
    }));
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/new-1/status', expect.anything());
  });

  it('saves a draft without calling anyone', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/save draft/i));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/nobody will be called/i), 'success'));
    expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.any(Object));
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/new-1/status', expect.anything());
  });

  it('stays put and says why when creating fails', async () => {
    apiPost.mockRejectedValue({ response: { data: { error: 'Server exploded' } } });
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/start calling 1 person/i));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Server exploded', 'error'));
    expect(screen.queryByText('Campaign Page')).not.toBeInTheDocument();
  });
});

describe('people', () => {
  it('reports skipped lines and duplicates, and can undo an import', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(button(/start with a blank script/i));
    await user.click(button(/next: add people/i));
    await user.type(screen.getByLabelText('Paste names and numbers'), 'Priya, 9876543210{Enter}Priya again, 98765 43210{Enter}nonsense');
    await user.click(button(/^person_add add$/i));

    const alert = screen.getByText(/added 1 person from pasted list/i).closest('[role="status"]');
    expect(within(alert).getByText(/1 number already on the list/)).toBeInTheDocument();
    expect(within(alert).getByText(/1 row skipped/)).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText('Priya')).not.toBeInTheDocument();
  });

  it('edits a person and personalises their call', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button('Edit Priya Sharma'));
    const dialog = screen.getByRole('dialog');
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Priya S');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.type(within(dialog).getByLabelText('Opening line'), 'Hello Priya!');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Priya S')).toBeInTheDocument();
    expect(screen.getByText('Personalised')).toBeInTheDocument();
  });
});

describe('editing an existing campaign', () => {
  const existing = {
    name: 'Existing Campaign',
    type: 'HR',
    dataToCollect: [{ itemType: 'question', text: 'Q?', weight: 100 }],
    callModule: { goal: 'g', callIntro: 'Hi [Name]', callSignOff: 's' },
    campaignContacts: [{ contact: { name: 'C', phone: '+919811111111' }, overrides: {} }],
    callSettings: { language: 'English', maxDuration: 5 },
    rules: {},
  };

  it('loads it straight into the editor', async () => {
    apiGet.mockResolvedValue({ data: existing });
    renderBuilder('/edit-campaign/abc');
    expect(await screen.findByLabelText('Campaign name')).toHaveValue('Existing Campaign');
    expect(apiGet).toHaveBeenCalledWith('/api/campaigns/abc');
    expect(screen.getByLabelText('Question 1')).toHaveValue('Q?');
    expect(screen.queryByLabelText('Describe your calls')).not.toBeInTheDocument();
  });

  it('saves with PUT, not POST', async () => {
    apiGet.mockResolvedValue({ data: existing });
    apiPut.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderBuilder('/edit-campaign/abc');
    await screen.findByLabelText('Campaign name');
    await user.click(button(/^save$/i));

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/api/campaigns/wizard/abc', expect.objectContaining({ name: 'Existing Campaign' })));
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/wizard', expect.anything());
  });

  it('still opens the editor when loading fails', async () => {
    apiGet.mockRejectedValue(new Error('nope'));
    renderBuilder('/edit-campaign/abc');
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/could not load/i), 'error'));
    expect(screen.getByLabelText('Campaign name')).toBeInTheDocument();
  });
});
