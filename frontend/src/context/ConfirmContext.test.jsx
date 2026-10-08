import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './ConfirmContext.jsx';

// Drives the dialog the way a screen does: a button awaits confirm() and
// renders the answer it got back.
function Asker({ options }) {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button type="button" onClick={async () => setAnswer(String(await confirm(options)))}>Ask</button>
      <output>{answer}</output>
    </>
  );
}

function setup(options) {
  render(<ConfirmProvider><Asker options={options} /></ConfirmProvider>);
  return userEvent.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('ConfirmProvider', () => {
  it('resolves true when the confirm button is pressed', async () => {
    await setup({ title: 'Remove Asha?', body: 'They lose access.', confirmLabel: 'Remove' });
    expect(screen.getByRole('alertdialog', { name: 'Remove Asha?' })).toHaveAccessibleDescription('They lose access.');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('true')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on Cancel', async () => {
    await setup('Discard draft?');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('false')).toBeInTheDocument();
  });

  it('resolves false on Escape', async () => {
    await setup('Discard draft?');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('false')).toBeInTheDocument();
  });

  it('a non-danger tone renders a plain dialog with a primary action', async () => {
    await setup({ title: 'Publish?', tone: 'info', confirmLabel: 'Publish' });
    expect(screen.getByRole('dialog', { name: 'Publish?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });
});
