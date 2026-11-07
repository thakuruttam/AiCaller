import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The builder end to end, with its real steps — only the network, toasts
// and the confirm dialog are stubbed.

// Each flow types whole sentences keystroke by keystroke through the real
// page; that takes 2–3s alone and can pass 5s when the full suite runs in
// parallel.
vi.setConfig({ testTimeout: 20000 });

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

/** People come first now: from the people step to choosing how to start the script. */
async function toScript(user) {
  await user.click(button(/next: write the call/i));
}

/** One pasted contact → blank script with a name and one question → review. */
async function buildReadyCampaign(user) {
  await user.type(screen.getByLabelText('Paste names and numbers'), 'Priya Sharma, 98765 43210');
  await user.click(button(/^person_add add$/i));
  await toScript(user);
  await user.click(button(/start with a blank script/i));
  await user.type(screen.getByLabelText('Campaign name'), 'Quick check');
  await user.type(screen.getByLabelText('Question 1'), 'Are you free to talk?');
  await user.click(button(/next: review & start/i));
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
  it('opens on who to call, then offers a choice of call — and loads nothing', async () => {
    const user = userEvent.setup();
    renderBuilder();
    expect(screen.getByText('Who are you calling?')).toBeInTheDocument();
    expect(screen.getByLabelText('Paste names and numbers')).toBeInTheDocument();
    await toScript(user);
    expect(screen.getByRole('radio', { name: /ask questions/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByLabelText('Describe your calls')).not.toBeInTheDocument();
    expect(button(/screen job applicants/i)).toBeInTheDocument();
    expect(button(/start with a blank script/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Question 1')).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('a template fills in the whole script', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/screen job applicants/i));

    expect(screen.getByLabelText('Campaign name')).toHaveValue('Applicant screening');
    expect(screen.getByLabelText('Question 1')).toHaveValue('Are you still interested in this role?');
    expect(screen.getByLabelText('Opening line').value).toContain('[Name]');
    // Its deliberate gap is flagged on the line it's in.
    expect(screen.getAllByText(/Opening line: replace \[Company\]/).length).toBeGreaterThan(0);
  });

  it('starting over keeps the people already added', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/start over/i));
    await user.click(button(/collect customer feedback/i));
    await user.click(button(/who you're calling/i));
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });
});

describe('writing the script', () => {
  it('Enter adds the next question', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'First?{Enter}');
    expect(screen.getByLabelText('Question 2')).toHaveFocus();
  });

  it('moves and removes lines', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'First?{Enter}Second?');
    await user.click(button('Move line 2 up'));
    expect(screen.getByLabelText('Question 1')).toHaveValue('Second?');
    await user.click(button('Remove line 1'));
    expect(screen.getByLabelText('Question 1')).toHaveValue('First?');
    expect(screen.queryByLabelText('Question 2')).not.toBeInTheDocument();
  });

  it('sets what each answer leads to, then folds the line to a readable summary', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'Are you free to talk?');

    // The wording makes it a yes/no question, so its two answers are laid out.
    expect(screen.getByLabelText('Question 1 — kind of answer')).toHaveValue('yesno');
    await user.selectOptions(screen.getByLabelText('Question 1 — if no, then'), 'end_call');
    await user.click(button('Yes is a good answer to question 1'));

    // Leaving the line folds it; what it does stays visible.
    await user.click(screen.getByLabelText('Opening line'));
    expect(screen.queryByLabelText('Question 1 — if no, then')).not.toBeInTheDocument();
    const facts = screen.getByRole('list', { name: 'What line 1 does' });
    expect(within(facts).getByText('If no → ends the call')).toBeInTheDocument();
    expect(within(facts).getByText('Good answer: yes')).toBeInTheDocument();
  });

  it('compares a number answer against a threshold', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'What is your notice period?');

    expect(screen.getByLabelText('Question 1 — kind of answer')).toHaveValue('number');
    await user.type(screen.getByLabelText('Question 1 — number to compare with'), '30');
    await user.type(screen.getByLabelText('Question 1 — unit'), 'days');
    await user.click(button('Less than 30 days is a good answer to question 1'));
    await user.click(screen.getByLabelText('Opening line'));
    expect(screen.getByText('Good answer: less than 30 days')).toBeInTheDocument();
  });

  it('shares the score between questions in one place', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.type(screen.getByLabelText('Question 1'), 'First?{Enter}Second?');
    await user.click(button(/scoring and call rules/i));

    const first = screen.getByLabelText('Question 1 share of the score');
    expect(first).toHaveValue(50);
    await user.clear(first);
    await user.type(first, '70');
    expect(screen.getByLabelText('Question 2 share of the score')).toHaveValue(30);
    expect(screen.getByText(/custom score split/i)).toBeInTheDocument();
  });
});

describe('launching', () => {
  it('cannot start until everything is in place, and says what is missing', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.click(button(/next: review & start/i));
    expect(button(/start calling/i)).toBeDisabled();
    expect(screen.getAllByText(/give the campaign a name/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/add the people you want to call/i).length).toBeGreaterThan(0);
  });

  it('creates the campaign, starts it and opens it', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/start calling 1 person/i));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/new-1/status', { action: 'start' }));
    // The script is saved without people; people go through the chunked sync.
    const wizard = apiPost.mock.calls.find(([u]) => u === '/api/campaigns/wizard')[1];
    expect(wizard).toMatchObject({ name: 'Quick check', dataToCollect: [expect.objectContaining({ text: 'Are you free to talk?', weight: 100 })] });
    expect(wizard).not.toHaveProperty('contacts');
    const sync = apiPost.mock.calls.find(([u]) => u === '/api/campaigns/new-1/contacts/sync')[1];
    expect(sync).toMatchObject({ chunkIndex: 0, rowOffset: 0, final: true, rows: [expect.objectContaining({ name: 'Priya Sharma', phone: '+919876543210' })] });
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
    await user.type(screen.getByLabelText('Paste names and numbers'), 'Priya, 9876543210{Enter}Priya again, 98765 43210{Enter}nonsense');
    await user.click(button(/^person_add add$/i));

    const alert = screen.getByText(/added 1 person from pasted list/i).closest('[role="status"]');
    expect(within(alert).getByText(/1 duplicate phone number removed — the first row was kept/)).toBeInTheDocument();
    expect(within(alert).getByText(/1 row skipped/)).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText('Priya')).not.toBeInTheDocument();
  });

  it('edits a person and personalises their call', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await buildReadyCampaign(user);
    await user.click(button(/who you're calling/i));
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
    // Nobody was added or changed, so people aren't re-sent.
    expect(apiPost).not.toHaveBeenCalledWith('/api/campaigns/abc/contacts/sync', expect.anything());
  });

  it('still opens the editor when loading fails', async () => {
    apiGet.mockRejectedValue(new Error('nope'));
    renderBuilder('/edit-campaign/abc');
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/could not load/i), 'error'));
    expect(screen.getByLabelText('Campaign name')).toBeInTheDocument();
  });
});

describe('conversation campaigns', () => {
  async function startDemoBrief(user) {
    renderBuilder();
    await toScript(user);
    await user.click(screen.getByRole('radio', { name: /have a conversation/i }));
    await user.click(button(/book product demos/i));
  }

  it('choosing "Have a conversation" offers briefs instead of question scripts', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(screen.getByRole('radio', { name: /have a conversation/i }));
    expect(button(/book product demos/i)).toBeInTheDocument();
    expect(button(/start with a blank brief/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Describe your calls')).not.toBeInTheDocument();
  });

  it('a brief template opens the brief editor, not the question list', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    expect(screen.getByLabelText('Campaign name')).toHaveValue('Demo calls');
    expect(screen.getByLabelText('What the agent knows')).toHaveValue('');
    expect(screen.queryByLabelText('Question 1')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Never rules' })).toHaveTextContent('Offer discounts or special pricing');
  });

  it('adds and removes rules', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    await user.type(screen.getByLabelText('Add a always rule'), 'Mention the free trial{Enter}');
    expect(screen.getByRole('list', { name: 'Always rules' })).toHaveTextContent('Mention the free trial');
    await user.click(button('Remove "Talk about competitors"'));
    expect(screen.getByRole('list', { name: 'Never rules' })).not.toHaveTextContent('Talk about competitors');
  });

  it('the test chat sends the brief as it stands and shows how the call ended', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    await user.type(screen.getByLabelText('What the agent knows'), 'Acme CRM costs 999 a month.');
    apiPost.mockImplementation((url) => {
      if (url === '/api/campaigns/try-chat') return Promise.resolve({ data: { reply: '', endCall: { reason: 'not_interested', closingLine: 'Thanks so much for your time. Have a great day!' } } });
      return Promise.resolve({ data: {} });
    });
    await user.type(screen.getByLabelText('Your reply as the caller'), 'Not interested, thanks.{Enter}');

    await waitFor(() => expect(screen.getByText(/Call ended · Not interested/)).toBeInTheDocument());
    const [url, body] = apiPost.mock.calls.find(([u]) => u === '/api/campaigns/try-chat');
    expect(url).toBe('/api/campaigns/try-chat');
    expect(body.payload.conversation.knowledge).toBe('Acme CRM costs 999 a month.');
    expect(body.messages).toEqual([{ role: 'user', text: 'Not interested, thanks.' }]);
    expect(screen.getByLabelText('Your reply as the caller')).toBeDisabled();
  });

  it('lists every way a call ends, including the time limit', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    expect(screen.getByText(/The objective is reached/)).toBeInTheDocument();
    expect(screen.getByText(/It's going nowhere/)).toBeInTheDocument();
    expect(screen.getByText(/Time's up at 5 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Hang up once the objective is reached/)).not.toBeInTheDocument();
  });

  it('collects only the listed details, and the test chat shows what was saved', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    expect(screen.getByRole('list', { name: 'Details to note' })).toHaveTextContent('Email');
    expect(screen.getByLabelText(/When can meetings happen/)).toHaveValue('Monday to Friday, 10am to 6pm IST');
    apiPost.mockImplementation((url) => {
      if (url === '/api/campaigns/try-chat') return Promise.resolve({ data: { reply: 'Thanks, noted.', endCall: null, captured: { Email: 'u@x.com' } } });
      return Promise.resolve({ data: {} });
    });
    await user.type(screen.getByLabelText('Your reply as the caller'), 'It is u@x.com{Enter}');
    await waitFor(() => expect(screen.getByLabelText('Details saved with this call')).toHaveTextContent('u@x.com'));
  });

  it('picking a kind of call fills the goal and the steps, and the steps can be restored', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    expect(screen.getByLabelText('How the call should go').value).toMatch(/15-minute demo/);
    await user.click(screen.getByRole('radio', { name: /sell a product/i }));
    expect(screen.getByLabelText('How the call should go').value).toMatch(/Ask what they are looking for, before suggesting anything/);
    expect(screen.getByLabelText(/What should have happened by the end/)).toHaveValue('Find a product from our list that they want to buy.');
    await user.clear(screen.getByLabelText('How the call should go'));
    await user.click(button(/use suggested steps/i));
    expect(screen.getByLabelText('How the call should go').value).toMatch(/^1\. Say in one line/);
  });

  it('saves mode and conversation with the campaign', async () => {
    const user = userEvent.setup();
    await startDemoBrief(user);
    await user.type(screen.getByLabelText('What the agent knows'), 'Acme CRM.');
    await user.click(button(/save draft/i));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/campaigns/wizard', expect.anything()));
    const body = apiPost.mock.calls.find(([u]) => u === '/api/campaigns/wizard')[1];
    expect(body.mode).toBe('conversation');
    expect(body.conversation.knowledge).toBe('Acme CRM.');
    expect(body.dataToCollect).toEqual([]);
  });
});

describe('uploading a sheet with extra columns', () => {
  it('maps name (from two columns), phone and the other columns to variables, shown in the variables panel', async () => {
    const user = userEvent.setup();
    renderBuilder();
    const csv = 'First Name,Last Name,Mobile,Amount,Last date\nRakesh,Kumar,98765 43210,460,12/11/2026\nSunita,Rao,91234 56789,1250,15/11/2026\n';
    await user.upload(screen.getByLabelText('Upload a contacts file'), new File([csv], 'dues.csv', { type: 'text/csv' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name column 1')).toHaveValue('First Name');
    expect(within(dialog).getByLabelText('Name column 2')).toHaveValue('Last Name');
    expect(within(dialog).getByLabelText('Phone column')).toHaveValue('Mobile');
    // A sheet, not a schema: no type pickers, values shown as written.
    expect(within(dialog).queryByLabelText('Type of Amount')).toBeNull();
    expect(within(dialog).getByText('460')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /add 2 rows/i }));

    expect(screen.getByText('Rakesh Kumar')).toBeInTheDocument();
    const panel = screen.getByRole('list', { name: 'Variables' });
    expect(within(panel).getByLabelText('Name of Amount')).toHaveValue('amount');
    expect(within(panel).getByLabelText('Name of Last date')).toHaveValue('last_date');
  });
});

describe('using variables in the call', () => {
  async function uploadDues(user) {
    const csv = 'Name,Mobile,Amount,Last date\nRakesh Kumar,98765 43210,460,12/11/2026\nSunita Rao,91234 56789,1250,15/11/2026\n';
    await user.upload(screen.getByLabelText('Upload a contacts file'), new File([csv], 'dues.csv', { type: 'text/csv' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add 2 rows/i }));
  }

  it('## opens the picker in the opening line and inserts the variable', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await uploadDues(user);
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    const opening = screen.getByLabelText('Opening line');
    await user.type(opening, 'Hi ##am');
    const list = screen.getByRole('listbox', { name: 'Variables' });
    expect(within(list).getByText('{{amount}}')).toBeInTheDocument();
    expect(within(list).getByText('460')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(opening).toHaveValue('Hi {{amount}}');
  });

  it('previews the call for any person on the list, filled in', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await uploadDues(user);
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.click(screen.getByLabelText('Opening line'));
    await user.paste('Hi {{name}}, {{amount}} is due by {{last_date}}.');
    expect(screen.getByText('Hi Rakesh Kumar, 460 is due by 12/11/2026.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Preview as'), 'Sunita Rao');
    expect(screen.getByText('Hi Sunita Rao, 1250 is due by 15/11/2026.')).toBeInTheDocument();
  });

  it('a {{name}} typed before any upload becomes a variable waiting for a column', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await toScript(user);
    await user.click(button(/start with a blank script/i));
    await user.click(screen.getByLabelText('Opening line'));
    await user.paste('Hi, about your {{branch}} visit');
    await user.click(button(/who you're calling/i));
    const panel = screen.getByRole('list', { name: 'Variables' });
    expect(within(panel).getByLabelText('Name of branch')).toHaveValue('branch');
    expect(within(panel).getByText(/needs a column/i)).toBeInTheDocument();
  });

  it('Try it plays the preview person, with their values', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await uploadDues(user);
    await toScript(user);
    await user.click(screen.getByRole('radio', { name: /have a conversation/i }));
    await user.click(button(/start with a blank brief/i));
    apiPost.mockImplementation((url) => {
      if (url === '/api/campaigns/try-chat') return Promise.resolve({ data: { reply: 'It is ₹460.', endCall: null, captured: {} } });
      return Promise.resolve({ data: {} });
    });
    expect(screen.getByText(/You're Rakesh Kumar/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your reply as the caller'), 'How much do I owe?{Enter}');
    await waitFor(() => expect(screen.getByText('It is ₹460.')).toBeInTheDocument());
    const body = apiPost.mock.calls.find(([u]) => u === '/api/campaigns/try-chat')[1];
    expect(body.contactName).toBe('Rakesh Kumar');
    expect(Object.values(body.person.vars)).toEqual(['460', '12/11/2026']);
    expect(body.payload.variables.map(v => v.key)).toEqual(['amount', 'last_date']);
  });
});
